package bot

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/slack-go/slack"

	"github.com/honestbank/runbookbot/llm"
)

const (
	maxHistoryMessages = 200
	maxPastIncidents   = 3
	// maxThreadChecks limits how many thread reply fetches we do to avoid excessive API calls.
	maxThreadChecks = 10
)

// IncidentSearcher searches Slack channel history for related past incidents.
type IncidentSearcher struct {
	client *slack.Client
	logger *slog.Logger
}

// NewIncidentSearcher creates a new IncidentSearcher.
func NewIncidentSearcher(client *slack.Client, logger *slog.Logger) *IncidentSearcher {
	return &IncidentSearcher{
		client: client,
		logger: logger,
	}
}

// SearchPastIncidents fetches recent channel history (newest first) and returns the latest
// messages or threads that contain any of the given keywords, excluding the current thread.
// For thread-parent messages, replies are also checked so incidents discussed in threads are found.
func (s *IncidentSearcher) SearchPastIncidents(ctx context.Context, channelID, excludeThreadTS string, keywords []string) ([]llm.PastIncident, error) {
	if len(keywords) == 0 {
		return nil, nil
	}

	resp, err := s.client.GetConversationHistoryContext(ctx, &slack.GetConversationHistoryParameters{
		ChannelID: channelID,
		Limit:     maxHistoryMessages,
	})
	if err != nil {
		return nil, fmt.Errorf("get conversation history: %w", err)
	}

	lowered := make([]string, len(keywords))
	for i, kw := range keywords {
		lowered[i] = strings.ToLower(kw)
	}

	var incidents []llm.PastIncident
	threadChecks := 0

	// Slack returns messages newest-first, so the first matches are the most recent.
	for _, msg := range resp.Messages {
		if len(incidents) >= maxPastIncidents {
			break
		}

		// Exclude the current incident's thread.
		ts := msg.Timestamp
		if ts == excludeThreadTS {
			continue
		}

		threadURL := fmt.Sprintf("https://slack.com/archives/%s/p%s",
			channelID, strings.ReplaceAll(ts, ".", ""))

		// Check the top-level message text.
		if containsKeyword(msg.Text, lowered) {
			incidents = append(incidents, llm.PastIncident{Text: msg.Text, URL: threadURL})
			continue
		}

		// If this message started a thread, fetch replies and check those too.
		if msg.ReplyCount > 0 && threadChecks < maxThreadChecks {
			threadChecks++
			if text, found := s.threadContainsKeyword(ctx, channelID, ts, lowered); found {
				incidents = append(incidents, llm.PastIncident{Text: text, URL: threadURL})
			}
		}
	}

	s.logger.Info("found past incidents in channel history",
		"count", len(incidents),
		"thread_checks", threadChecks,
		"keywords", keywords,
	)
	return incidents, nil
}

// threadContainsKeyword fetches thread replies and returns the first reply text that matches,
// along with true. Returns ("", false) if no reply matches.
func (s *IncidentSearcher) threadContainsKeyword(ctx context.Context, channelID, threadTS string, loweredKeywords []string) (string, bool) {
	replies, _, _, err := s.client.GetConversationRepliesContext(ctx, &slack.GetConversationRepliesParameters{
		ChannelID: channelID,
		Timestamp: threadTS,
		Limit:     50,
	})
	if err != nil {
		s.logger.Debug("failed to fetch thread replies for history search", "thread_ts", threadTS, "error", err)
		return "", false
	}

	for _, reply := range replies {
		// Skip the thread parent (already checked) and bot messages.
		if reply.Timestamp == threadTS || reply.BotID != "" || reply.User == "" {
			continue
		}
		if containsKeyword(reply.Text, loweredKeywords) {
			return reply.Text, true
		}
	}
	return "", false
}

// containsKeyword reports whether text (lowercased) contains any of the given (already lowered) keywords.
func containsKeyword(text string, loweredKeywords []string) bool {
	if text == "" {
		return false
	}
	lower := strings.ToLower(text)
	for _, kw := range loweredKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}
