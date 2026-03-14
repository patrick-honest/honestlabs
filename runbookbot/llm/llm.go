package llm

import (
	"context"
	"fmt"
	"strings"

	bq "github.com/honestbank/runbookbot/bigquery"
	"github.com/honestbank/runbookbot/notion"
)

const (
	SystemPrompt = `You are RunbookBot, an on-call incident triage assistant for Honest Bank's engineering team. When engineers post about pager incidents, you help them triage and respond effectively.

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

*Customer Info*
{ONLY include this section if customer information was found from the user_id in the incident. Show:}
• User ID: {user_id}
• URN: {urn}
• LOC Account: {loc_acct}
• Card Brand: {card_brand - translate LC=Local, VS=Visa, MC=MasterCard, UP=UnionPay}
• Card Product: {card_product - translate C=Classic, G=Gold, P=Platinum}

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

	LearningsSystemPrompt = `You are RunbookBot's knowledge capture system. Your job is to analyze incident Slack threads and extract useful troubleshooting learnings that should be added to runbooks.

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

// Client is the interface that both Claude and Gemini backends implement.
type Client interface {
	GenerateResponse(ctx context.Context, threadMessages []string, runbooks []notion.Runbook, pastIncidents []PastIncident, customers []*bq.CustomerInfo) (string, error)
	ExtractLearnings(ctx context.Context, threadMessages []string) (string, error)
}

// cardBrandName translates card brand codes to human-readable names.
func cardBrandName(code string) string {
	switch strings.ToUpper(strings.TrimSpace(code)) {
	case "LC":
		return "Local"
	case "VS":
		return "Visa"
	case "MC":
		return "MasterCard"
	case "UP":
		return "UnionPay"
	default:
		return code
	}
}

// cardProductName translates card product codes to human-readable names.
func cardProductName(code string) string {
	switch strings.ToUpper(strings.TrimSpace(code)) {
	case "C":
		return "Classic"
	case "G":
		return "Gold"
	case "P":
		return "Platinum"
	default:
		return code
	}
}

// BuildUserMessage assembles the prompt with thread context, runbook references, past incidents, and customer info.
func BuildUserMessage(threadMessages []string, runbooks []notion.Runbook, pastIncidents []PastIncident, customers []*bq.CustomerInfo) string {
	var sb strings.Builder

	sb.WriteString("## Incident Thread Context\n\n")
	for i, msg := range threadMessages {
		sb.WriteString(fmt.Sprintf("Message %d: %s\n\n", i+1, msg))
	}

	if len(customers) > 0 {
		sb.WriteString("## Customer Information (from BigQuery)\n\n")
		for _, c := range customers {
			sb.WriteString(fmt.Sprintf("- User ID: %s\n", c.UserID))
			if c.URN != "" {
				sb.WriteString(fmt.Sprintf("  URN: %s\n", c.URN))
			}
			if c.LocAcct != "" {
				sb.WriteString(fmt.Sprintf("  LOC Account: %s\n", c.LocAcct))
			}
			if c.CardBrand != "" {
				sb.WriteString(fmt.Sprintf("  Card Brand: %s (%s)\n", c.CardBrand, cardBrandName(c.CardBrand)))
			}
			if c.CardProduct != "" {
				sb.WriteString(fmt.Sprintf("  Card Product: %s (%s)\n", c.CardProduct, cardProductName(c.CardProduct)))
			}
			sb.WriteString("\n")
		}
		sb.WriteString("Include this customer information in your response under the *Customer Info* section.\n\n")
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

// BuildLearningsMessage assembles the prompt for extracting learnings from a thread.
func BuildLearningsMessage(threadMessages []string) string {
	var sb strings.Builder
	sb.WriteString("## Incident Thread to Analyze\n\n")
	for i, msg := range threadMessages {
		sb.WriteString(fmt.Sprintf("Message %d: %s\n\n", i+1, msg))
	}
	sb.WriteString("\nAnalyze this thread. If actionable learnings exist, extract them. Otherwise respond with exactly NO_LEARNINGS.")
	return sb.String()
}
