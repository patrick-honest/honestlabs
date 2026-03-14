package gemini

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"google.golang.org/genai"

	"github.com/honestbank/runbookbot/llm"
	"github.com/honestbank/runbookbot/notion"
)

const model = "gemini-2.0-flash"

// Client wraps the Google Generative AI SDK and implements llm.Client.
type Client struct {
	client *genai.Client
	logger *slog.Logger
}

// NewClient creates a new Gemini API client.
func NewClient(ctx context.Context, apiKey string, logger *slog.Logger) (*Client, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("create gemini client: %w", err)
	}
	return &Client{client: client, logger: logger}, nil
}

// GenerateResponse sends thread context, runbooks, and past incidents to Gemini and returns the response.
func (c *Client) GenerateResponse(ctx context.Context, threadMessages []string, runbooks []notion.Runbook, pastIncidents []llm.PastIncident) (string, error) {
	userMessage := llm.BuildUserMessage(threadMessages, runbooks, pastIncidents)

	c.logger.Info("calling gemini API",
		"thread_messages", len(threadMessages),
		"runbooks", len(runbooks),
		"past_incidents", len(pastIncidents),
	)

	result, err := c.client.Models.GenerateContent(ctx, model,
		genai.Text(userMessage),
		&genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{{Text: llm.SystemPrompt}},
			},
			MaxOutputTokens: 1500,
		},
	)
	if err != nil {
		return "", fmt.Errorf("gemini API request: %w", err)
	}

	text := strings.TrimSpace(result.Text())
	if text == "" {
		return "", fmt.Errorf("gemini returned empty response")
	}
	return text, nil
}

// ExtractLearnings analyzes a thread and extracts actionable troubleshooting learnings.
// Returns empty string if no learnings are found (thread not resolved yet).
func (c *Client) ExtractLearnings(ctx context.Context, threadMessages []string) (string, error) {
	if len(threadMessages) < 4 {
		return "", nil
	}

	c.logger.Info("checking thread for learnings", "messages", len(threadMessages))

	result, err := c.client.Models.GenerateContent(ctx, model,
		genai.Text(llm.BuildLearningsMessage(threadMessages)),
		&genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{{Text: llm.LearningsSystemPrompt}},
			},
			MaxOutputTokens: 1500,
		},
	)
	if err != nil {
		return "", fmt.Errorf("gemini learnings API request: %w", err)
	}

	text := strings.TrimSpace(result.Text())
	if text == "" || strings.Contains(text, "NO_LEARNINGS") {
		c.logger.Info("no learnings found in thread")
		return "", nil
	}

	c.logger.Info("extracted learnings from thread")
	return text, nil
}
