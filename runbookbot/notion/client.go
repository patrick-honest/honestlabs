package notion

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const (
	notionAPIBase    = "https://api.notion.com/v1"
	notionAPIVersion = "2022-06-28"
	maxResults       = 5
)

// Runbook represents a single runbook entry from Notion.
type Runbook struct {
	Title string
	URL   string
	ID    string // Page ID for appending content
}

// AppendResult holds the result of appending learnings to a Notion page.
type AppendResult struct {
	PageURL   string
	PageTitle string
}

// Client interacts with the Notion API.
type Client struct {
	apiKey     string
	databaseID string
	httpClient *http.Client
	logger     *slog.Logger
}

// NewClient creates a new Notion client.
func NewClient(apiKey, databaseID string, logger *slog.Logger) *Client {
	return &Client{
		apiKey:     apiKey,
		databaseID: databaseID,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		logger:     logger,
	}
}

// queryRequest is the body for a Notion database query.
type queryRequest struct {
	Filter   interface{} `json:"filter,omitempty"`
	PageSize int         `json:"page_size"`
}

// SearchRunbooks queries the Notion database for runbooks matching the given keywords.
// It extracts keywords from the message and searches the Title property.
func (c *Client) SearchRunbooks(ctx context.Context, message string) ([]Runbook, error) {
	keywords := extractKeywords(message)
	if len(keywords) == 0 {
		c.logger.Debug("no keywords extracted from message")
		return nil, nil
	}

	c.logger.Info("searching notion for runbooks", "keywords", keywords)

	// Build an OR filter across keywords matching against the Title property.
	var filters []interface{}
	for _, kw := range keywords {
		filters = append(filters, map[string]interface{}{
			"property": "Title",
			"title": map[string]interface{}{
				"contains": kw,
			},
		})
	}

	filter := map[string]interface{}{
		"or": filters,
	}

	body := queryRequest{
		Filter:   filter,
		PageSize: maxResults,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal query body: %w", err)
	}

	url := fmt.Sprintf("%s/databases/%s/query", notionAPIBase, c.databaseID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Notion-Version", notionAPIVersion)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("notion API request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("notion API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result queryResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode notion response: %w", err)
	}

	var runbooks []Runbook
	for _, page := range result.Results {
		title := extractTitle(page.Properties)
		pageURL := page.URL
		pageID := page.ID
		if title != "" {
			runbooks = append(runbooks, Runbook{
				Title: title,
				URL:   pageURL,
				ID:    pageID,
			})
		}
	}

	c.logger.Info("found runbooks", "count", len(runbooks))
	return runbooks, nil
}

// queryResponse is the top-level Notion database query response.
type queryResponse struct {
	Results []pageResult `json:"results"`
}

type pageResult struct {
	ID         string                 `json:"id"`
	URL        string                 `json:"url"`
	Properties map[string]interface{} `json:"properties"`
}

// AppendLearnings appends troubleshooting learnings to the bottom of a Notion page.
// It adds a divider, a heading with the date, and the learnings as paragraphs.
func (c *Client) AppendLearnings(ctx context.Context, pageID string, learnings string, slackThreadURL string) error {
	c.logger.Info("appending learnings to notion page", "page_id", pageID)

	now := time.Now().Format("2006-01-02 15:04")

	// Build blocks to append: divider, heading, learnings text, and slack link.
	blocks := map[string]interface{}{
		"children": []interface{}{
			// Divider
			map[string]interface{}{
				"object": "block",
				"type":   "divider",
				"divider": map[string]interface{}{},
			},
			// Heading with date
			map[string]interface{}{
				"object": "block",
				"type":   "heading_3",
				"heading_3": map[string]interface{}{
					"rich_text": []map[string]interface{}{
						{
							"type": "text",
							"text": map[string]string{
								"content": fmt.Sprintf("🔍 Incident Learnings — %s", now),
							},
						},
					},
				},
			},
			// Learnings content (callout block for visibility)
			map[string]interface{}{
				"object": "block",
				"type":   "callout",
				"callout": map[string]interface{}{
					"icon": map[string]interface{}{
						"type":  "emoji",
						"emoji": "📝",
					},
					"rich_text": []map[string]interface{}{
						{
							"type": "text",
							"text": map[string]string{
								"content": learnings,
							},
						},
					},
				},
			},
			// Link to Slack thread
			map[string]interface{}{
				"object": "block",
				"type":   "paragraph",
				"paragraph": map[string]interface{}{
					"rich_text": []map[string]interface{}{
						{
							"type": "text",
							"text": map[string]interface{}{
								"content": "📎 Source: Slack incident thread",
								"link": map[string]string{
									"url": slackThreadURL,
								},
							},
						},
					},
				},
			},
			// Review callout
			map[string]interface{}{
				"object": "block",
				"type":   "paragraph",
				"paragraph": map[string]interface{}{
					"rich_text": []map[string]interface{}{
						{
							"type": "text",
							"text": map[string]string{
								"content": "⚠️ Review needed: Please verify and incorporate these learnings into the runbook above.",
							},
							"annotations": map[string]interface{}{
								"bold":  true,
								"color": "orange",
							},
						},
					},
				},
			},
		},
	}

	payload, err := json.Marshal(blocks)
	if err != nil {
		return fmt.Errorf("marshal append body: %w", err)
	}

	url := fmt.Sprintf("%s/blocks/%s/children", notionAPIBase, pageID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create append request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Notion-Version", notionAPIVersion)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("notion append request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("notion append returned status %d: %s", resp.StatusCode, string(respBody))
	}

	c.logger.Info("successfully appended learnings to notion page", "page_id", pageID)
	return nil
}

// extractTitle pulls the title text out of the properties map.
func extractTitle(props map[string]interface{}) string {
	titleProp, ok := props["Title"]
	if !ok {
		// Try "Name" as a fallback — common in Notion databases.
		titleProp, ok = props["Name"]
		if !ok {
			return ""
		}
	}

	propMap, ok := titleProp.(map[string]interface{})
	if !ok {
		return ""
	}

	titleArr, ok := propMap["title"].([]interface{})
	if !ok {
		return ""
	}

	var parts []string
	for _, item := range titleArr {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if text, ok := itemMap["plain_text"].(string); ok {
			parts = append(parts, text)
		}
	}

	return strings.Join(parts, "")
}

// extractKeywords splits the message into meaningful search terms.
// It filters out common stop words and very short tokens.
func extractKeywords(message string) []string {
	stopWords := map[string]bool{
		"the": true, "a": true, "an": true, "is": true, "are": true,
		"was": true, "were": true, "be": true, "been": true, "being": true,
		"have": true, "has": true, "had": true, "do": true, "does": true,
		"did": true, "will": true, "would": true, "could": true, "should": true,
		"may": true, "might": true, "shall": true, "can": true, "need": true,
		"to": true, "of": true, "in": true, "for": true, "on": true,
		"with": true, "at": true, "by": true, "from": true, "it": true,
		"its": true, "this": true, "that": true, "and": true, "or": true,
		"but": true, "not": true, "so": true, "if": true, "then": true,
		"we": true, "our": true, "i": true, "my": true, "me": true,
		"you": true, "your": true, "he": true, "she": true, "they": true,
		"what": true, "which": true, "who": true, "when": true, "where": true,
		"how": true, "all": true, "each": true, "every": true, "both": true,
		"runbookbot": true, "hey": true, "hi": true, "hello": true,
		"please": true, "thanks": true, "thank": true,
	}

	// Clean up the message.
	msg := strings.ToLower(message)
	// Remove mentions like <@U12345>.
	for {
		start := strings.Index(msg, "<@")
		if start == -1 {
			break
		}
		end := strings.Index(msg[start:], ">")
		if end == -1 {
			break
		}
		msg = msg[:start] + msg[start+end+1:]
	}

	words := strings.FieldsFunc(msg, func(r rune) bool {
		return !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_')
	})

	seen := make(map[string]bool)
	var keywords []string
	for _, w := range words {
		if len(w) < 3 {
			continue
		}
		if stopWords[w] {
			continue
		}
		if seen[w] {
			continue
		}
		seen[w] = true
		keywords = append(keywords, w)
	}

	// Cap at 5 keywords to keep the Notion query reasonable.
	if len(keywords) > 5 {
		keywords = keywords[:5]
	}

	return keywords
}
