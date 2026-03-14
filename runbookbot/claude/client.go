package claude

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	bq "github.com/honestbank/runbookbot/bigquery"
	"github.com/honestbank/runbookbot/llm"
	"github.com/honestbank/runbookbot/notion"
)

const model = "claude-sonnet-4-20250514"

// Client wraps the Anthropic SDK and implements llm.Client.
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

// GenerateResponse sends thread context, runbooks, past incidents, and customer info to Claude and returns the response.
func (c *Client) GenerateResponse(ctx context.Context, threadMessages []string, runbooks []notion.Runbook, pastIncidents []llm.PastIncident, customers []*bq.CustomerInfo) (string, error) {
	userMessage := llm.BuildUserMessage(threadMessages, runbooks, pastIncidents, customers)

	c.logger.Info("calling claude API",
		"thread_messages", len(threadMessages),
		"runbooks", len(runbooks),
		"past_incidents", len(pastIncidents),
	)

	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: 1500,
		System: []anthropic.TextBlockParam{
			{Text: llm.SystemPrompt},
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
		return "", nil
	}

	c.logger.Info("checking thread for learnings", "messages", len(threadMessages))

	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: 1500,
		System: []anthropic.TextBlockParam{
			{Text: llm.LearningsSystemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewTextBlock(llm.BuildLearningsMessage(threadMessages)),
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
