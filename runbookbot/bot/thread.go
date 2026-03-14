package bot

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/slack-go/slack"
)

// ThreadReader reads thread context from Slack.
type ThreadReader struct {
	client *slack.Client
	botUID string
	logger *slog.Logger
}

// NewThreadReader creates a new ThreadReader.
func NewThreadReader(client *slack.Client, botUID string, logger *slog.Logger) *ThreadReader {
	return &ThreadReader{
		client: client,
		botUID: botUID,
		logger: logger,
	}
}

// ThreadContext contains information about a thread's messages.
type ThreadContext struct {
	Messages          []string // All human-readable messages in the thread.
	BotAlreadyReplied bool     // Whether the bot has already replied in this thread.
	NewHumanMessages  bool     // Whether there are new human messages after the bot's last reply.
	LatestMessage     string   // The latest message text (for keyword extraction).
}

// ReadThread fetches and analyzes all messages in a thread.
func (tr *ThreadReader) ReadThread(ctx context.Context, channelID, threadTS string) (*ThreadContext, error) {
	params := &slack.GetConversationRepliesParameters{
		ChannelID: channelID,
		Timestamp: threadTS,
		Limit:     100,
	}

	msgs, _, _, err := tr.client.GetConversationRepliesContext(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("get conversation replies: %w", err)
	}

	tc := &ThreadContext{}
	lastBotReplyIndex := -1

	for i, msg := range msgs {
		// Collect all non-bot messages as thread context.
		if msg.User == tr.botUID || msg.BotID != "" {
			if msg.User == tr.botUID {
				tc.BotAlreadyReplied = true
				lastBotReplyIndex = i
			}
			continue
		}

		text := msg.Text
		if text == "" {
			continue
		}
		tc.Messages = append(tc.Messages, text)
	}

	// Determine if there are new human messages after the last bot reply.
	if lastBotReplyIndex >= 0 {
		for i := lastBotReplyIndex + 1; i < len(msgs); i++ {
			if msgs[i].User != tr.botUID && msgs[i].BotID == "" && msgs[i].Text != "" {
				tc.NewHumanMessages = true
				break
			}
		}
	}

	if len(tc.Messages) > 0 {
		tc.LatestMessage = tc.Messages[len(tc.Messages)-1]
	}

	tr.logger.Debug("read thread context",
		"channel", channelID,
		"thread_ts", threadTS,
		"total_messages", len(tc.Messages),
		"bot_replied", tc.BotAlreadyReplied,
		"new_human_messages", tc.NewHumanMessages,
	)

	return tc, nil
}
