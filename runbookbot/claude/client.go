package claude

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/honestbank/runbookbot/notion"
)

const (
	model = "claude-sonnet-4-20250514"

	systemPrompt = `You are RunbookBot, an on-call incident triage assistant for Honest Bank's engineering team. When engineers post about pager incidents, you help them triage and respond effectively.

Format your response for Slack (use *bold*, _italic_, bullet points with •). Start with "🚨 *RunbookBot — Incident Triage*"

Your response MUST follow this exact structure:

*Initial hypothesis*
• {Analyze the incident details — check the runbooks provided, and use your knowledge of common failure patterns to form an initial hypothesis about the root cause. Be specific to the services/systems mentioned.}

*Suggested steps to take*
1. {First step the engineer should take}
2. {Second step}
3. {Continue with numbered steps — be specific, reference actual tools like Grafana dashboards, BigQuery, kubectl commands, log queries, etc.}

*Links to most recent related incidents*
• {List related past incidents from the Slack history provided to you, with their links. If none were provided, say "No recent related incidents found — check PagerDuty history for this service."}

*Relevant Runbooks*
• {List each runbook with its link and a brief description — these are provided to you}

*Vendor point-of-contact*
{ONLY include this section if the incident involves an external vendor/third-party service (e.g., Finexus, VIDA, Mastercard, Visa, Twilio, Durianpay, XL, Indosat, Telkomsel, Meta, Anteraja, etc.). If no vendor is involved, omit this section entirely.}
• Contact name: {vendor contact name if known from runbooks}
• Slack: {vendor slack channel if known}
• WhatsApp: {vendor whatsapp if known}
• Email: {vendor email if known}

IMPORTANT RULES:
- Be concise and actionable — engineers are under pressure during incidents
- The "Vendor point-of-contact" section should ONLY appear when a vendor/external service is involved
- Always include runbook links when they are provided to you
- If this is a follow-up message in an ongoing thread, don't repeat the full template — just provide targeted advice based on the question and thread context`

	learningsSystemPrompt = `You are RunbookBot's knowledge capture system. Your job is to analyze incident Slack threads and extract useful troubleshooting learnings that should be added to runbooks.

You have two tasks:

TASK 1 - DETERMINE IF THE THREAD CONTAINS ACTIONABLE LEARNINGS:
Respond with "NO_LEARNINGS" if:
- The thread is still ongoing with no resolution
- The thread only contains the initial alert and bot response
- No new troubleshooting steps, root causes, or fixes were shared

TASK 2 - IF THERE ARE LEARNINGS, EXTRACT THEM:
Summarize the learnings in a clear, structured format:

**Key Words:** The alert name or a one-phrase summary of the incident for future searching
**Root Cause:** What caused the incident
**Resolution:** What was done to fix it
**Troubleshooting Steps Taken:**
1. Step that was taken
2. Next step
**Key Findings:** Any important observations (e.g., specific logs, metrics, config issues)
**Prevention:** What could prevent this in the future (if discussed)

Keep it concise and factual — this will be appended to a Notion runbook page for future reference.
Do NOT include Slack formatting (* for bold) — use plain text with markdown ** for bold since this goes to Notion.`
)

// PastIncident represents a related incident found in Slack history.
type PastIncident struct {
	Text string
	URL  string
}

// Client wraps the Anthropic SDK.
type Client struct {
	client *anthropic.Client
	logger *slog.Logger
}

// NewClient creates a new Claude API client.
func NewClient(logger *slog.Logger) *Client {
	client := anthropic.NewClient()
	return &Client{
		client: &client,
		logger: logger,
	}
}

// GenerateResponse sends thread context, runbooks, and past incidents to Claude and returns the response.
func (c *Client) GenerateResponse(ctx context.Context, threadMessages []string, runbooks []notion.Runbook, pastIncidents []PastIncident) (string, error) {
	userMessage := buildUserMessage(threadMessages, runbooks, pastIncidents)

	c.logger.Info("calling claude API",
		"thread_messages", len(threadMessages),
		"runbooks", len(runbooks),
		"past_incidents", len(pastIncidents),
	)

	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: 1500,
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewTextBlock(userMessage),
			),
		},
	})
	if err != nil {
		return "", fmt.Errorf("claude API request: %w", err)
	}

	// Extract text from the response content blocks.
	var result strings.Builder
	for _, block := range resp.Content {
		if block.Type == "text" {
			result.WriteString(block.Text)
		}
	}

	if result.Len() == 0 {
		return "", fmt.Errorf("claude returned empty response")
	}

	return result.String(), nil
}

// ExtractLearnings analyzes a thread and extracts actionable troubleshooting learnings.
// Returns empty string if no learnings are found (thread not resolved yet).
func (c *Client) ExtractLearnings(ctx context.Context, threadMessages []string) (string, error) {
	if len(threadMessages) < 4 {
		// Too few messages to have meaningful learnings.
		return "", nil
	}

	var sb strings.Builder
	sb.WriteString("## Incident Thread to Analyze\n\n")
	for i, msg := range threadMessages {
		sb.WriteString(fmt.Sprintf("Message %d: %s\n\n", i+1, msg))
	}
	sb.WriteString("\nAnalyze this thread. If actionable learnings exist, extract them. Otherwise respond with exactly NO_LEARNINGS.")

	c.logger.Info("checking thread for learnings", "messages", len(threadMessages))

	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: 1500,
		System: []anthropic.TextBlockParam{
			{Text: learningsSystemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewTextBlock(sb.String()),
			),
		},
	})
	if err != nil {
		return "", fmt.Errorf("claude learnings API request: %w", err)
	}

	var result strings.Builder
	for _, block := range resp.Content {
		if block.Type == "text" {
			result.WriteString(block.Text)
		}
	}

	text := strings.TrimSpace(result.String())
	if text == "" || strings.Contains(text, "NO_LEARNINGS") {
		c.logger.Info("no learnings found in thread")
		return "", nil
	}

	c.logger.Info("extracted learnings from thread")
	return text, nil
}

// buildUserMessage assembles the prompt with thread context, runbook references, and past incidents.
func buildUserMessage(threadMessages []string, runbooks []notion.Runbook, pastIncidents []PastIncident) string {
	var sb strings.Builder

	sb.WriteString("## Incident Thread Context\n\n")
	for i, msg := range threadMessages {
		sb.WriteString(fmt.Sprintf("Message %d: %s\n\n", i+1, msg))
	}

	if len(runbooks) > 0 {
		sb.WriteString("## Relevant Runbooks Found\n\n")
		for _, rb := range runbooks {
			sb.WriteString(fmt.Sprintf("- [%s](%s)\n", rb.Title, rb.URL))
		}
		sb.WriteString("\nPlease reference these runbooks in your response and include the links.\n")
	} else {
		sb.WriteString("## Runbooks\nNo matching runbooks were found for this incident.\n")
	}

	if len(pastIncidents) > 0 {
		sb.WriteString("\n## Related Past Incidents from Slack History\n\n")
		for i, inc := range pastIncidents {
			sb.WriteString(fmt.Sprintf("%d. %s\n   Link: %s\n\n", i+1, inc.Text, inc.URL))
		}
	} else {
		sb.WriteString("\n## Related Past Incidents from Slack History\nNo related past incidents found in channel history.\n")
	}

	sb.WriteString("\nPlease provide incident triage assistance based on the thread above.")

	return sb.String()
}
