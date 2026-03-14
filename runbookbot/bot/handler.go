package bot

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/slack-go/slack"
	"github.com/slack-go/slack/slackevents"
	"github.com/slack-go/slack/socketmode"

	"github.com/honestbank/runbookbot/claude"
	"github.com/honestbank/runbookbot/notion"
)

// Handler processes incoming Slack events.
type Handler struct {
	slackClient   *slack.Client
	socketClient  *socketmode.Client
	notionClient  *notion.Client
	claudeClient  *claude.Client
	threadReader  *ThreadReader
	channelID     string
	botUID        string
	logger        *slog.Logger
}

// NewHandler creates a new event handler.
func NewHandler(
	slackClient *slack.Client,
	socketClient *socketmode.Client,
	notionClient *notion.Client,
	claudeClient *claude.Client,
	channelID string,
	logger *slog.Logger,
) (*Handler, error) {
	// Look up the bot's own user ID so we can identify our own messages.
	authResp, err := slackClient.AuthTest()
	if err != nil {
		return nil, fmt.Errorf("slack auth test: %w", err)
	}
	botUID := authResp.UserID
	logger.Info("bot authenticated", "bot_user_id", botUID, "team", authResp.Team)

	return &Handler{
		slackClient:  slackClient,
		socketClient: socketClient,
		notionClient: notionClient,
		claudeClient: claudeClient,
		threadReader: NewThreadReader(slackClient, botUID, logger),
		channelID:    channelID,
		botUID:       botUID,
		logger:       logger,
	}, nil
}

// Run starts listening for Socket Mode events. It blocks until the context is cancelled.
func (h *Handler) Run(ctx context.Context) error {
	go func() {
		for evt := range h.socketClient.Events {
			switch evt.Type {
			case socketmode.EventTypeEventsAPI:
				h.socketClient.Ack(*evt.Request)
				h.handleEventsAPI(ctx, evt)

			case socketmode.EventTypeConnecting:
				h.logger.Info("connecting to slack socket mode")

			case socketmode.EventTypeConnected:
				h.logger.Info("connected to slack socket mode")

			case socketmode.EventTypeConnectionError:
				h.logger.Error("slack socket mode connection error")

			default:
				h.socketClient.Ack(*evt.Request)
			}
		}
	}()

	return h.socketClient.RunContext(ctx)
}

// handleEventsAPI processes Events API payloads from Socket Mode.
func (h *Handler) handleEventsAPI(ctx context.Context, evt socketmode.Event) {
	eventsAPIEvent, ok := evt.Data.(slackevents.EventsAPIEvent)
	if !ok {
		return
	}

	switch ev := eventsAPIEvent.InnerEvent.Data.(type) {
	case *slackevents.MessageEvent:
		h.handleMessage(ctx, ev)
	}
}

// handleMessage processes a single message event.
func (h *Handler) handleMessage(ctx context.Context, ev *slackevents.MessageEvent) {
	// Only process messages in the configured channel.
	if ev.Channel != h.channelID {
		return
	}

	// Skip bot messages, message edits, deletes, and system subtypes.
	if ev.BotID != "" || ev.User == "" || ev.User == h.botUID {
		return
	}
	if ev.SubType != "" {
		// Subtypes include message_changed, message_deleted, channel_join, etc.
		h.logger.Debug("skipping message subtype", "subtype", ev.SubType)
		return
	}

	h.logger.Info("received message",
		"user", ev.User,
		"channel", ev.Channel,
		"thread_ts", ev.ThreadTimeStamp,
		"has_mention", strings.Contains(ev.Text, h.botUID),
	)

	// Determine the thread timestamp. If the message is not in a thread,
	// use the message's own timestamp as the parent.
	threadTS := ev.ThreadTimeStamp
	if threadTS == "" {
		threadTS = ev.TimeStamp
	}

	// Read the full thread context.
	threadCtx, err := h.threadReader.ReadThread(ctx, ev.Channel, threadTS)
	if err != nil {
		h.logger.Error("failed to read thread", "error", err)
		return
	}

	// If the bot already replied and there are no new human messages, skip.
	isMention := strings.Contains(ev.Text, h.botUID) || strings.Contains(strings.ToLower(ev.Text), "@runbookbot")
	if threadCtx.BotAlreadyReplied && !threadCtx.NewHumanMessages && !isMention {
		h.logger.Debug("bot already replied, no new human messages, skipping")
		return
	}

	// If no thread messages were found, use the current message.
	messages := threadCtx.Messages
	if len(messages) == 0 {
		messages = []string{ev.Text}
	}

	// Use the latest message (or the full thread) for runbook search.
	searchText := ev.Text
	if threadCtx.LatestMessage != "" {
		searchText = threadCtx.LatestMessage
	}
	// Also include the first message for broader context.
	if len(messages) > 0 && messages[0] != searchText {
		searchText = messages[0] + " " + searchText
	}

	// Search Notion for relevant runbooks.
	runbooks, err := h.notionClient.SearchRunbooks(ctx, searchText)
	if err != nil {
		h.logger.Error("failed to search notion runbooks", "error", err)
		// Continue without runbooks — we can still provide triage advice.
		runbooks = nil
	}

	// Generate response from Claude.
	response, err := h.claudeClient.GenerateResponse(ctx, messages, runbooks)
	if err != nil {
		h.logger.Error("failed to generate claude response", "error", err)
		h.postErrorReply(ev.Channel, threadTS)
		return
	}

	// Reply in the thread.
	_, _, err = h.slackClient.PostMessageContext(ctx,
		ev.Channel,
		slack.MsgOptionText(response, false),
		slack.MsgOptionTS(threadTS),
	)
	if err != nil {
		h.logger.Error("failed to post slack reply", "error", err)
		return
	}

	h.logger.Info("replied to message",
		"channel", ev.Channel,
		"thread_ts", threadTS,
		"runbooks_found", len(runbooks),
	)

	// After replying, check if the thread now contains actionable learnings
	// that should be captured in Notion.
	go h.captureThreadLearnings(ctx, ev.Channel, threadTS, messages, runbooks)
}

// captureThreadLearnings checks if the thread has actionable learnings and
// appends them to the relevant Notion runbook page, then posts a link in the thread.
func (h *Handler) captureThreadLearnings(ctx context.Context, channel, threadTS string, messages []string, runbooks []notion.Runbook) {
	// Only attempt if there are runbooks to append to.
	if len(runbooks) == 0 {
		h.logger.Debug("no runbooks to append learnings to, skipping capture")
		return
	}

	// Ask Claude to extract learnings from the thread.
	learnings, err := h.claudeClient.ExtractLearnings(ctx, messages)
	if err != nil {
		h.logger.Error("failed to extract learnings from thread", "error", err)
		return
	}

	if learnings == "" {
		h.logger.Debug("no actionable learnings found in thread yet")
		return
	}

	// Build the Slack thread URL for the Notion reference.
	slackThreadURL := fmt.Sprintf("https://slack.com/archives/%s/p%s", channel, strings.ReplaceAll(threadTS, ".", ""))

	// Append learnings to the first (most relevant) runbook.
	targetRunbook := runbooks[0]
	if targetRunbook.ID == "" {
		h.logger.Warn("runbook has no page ID, cannot append learnings", "title", targetRunbook.Title)
		return
	}

	err = h.notionClient.AppendLearnings(ctx, targetRunbook.ID, learnings, slackThreadURL)
	if err != nil {
		h.logger.Error("failed to append learnings to notion", "error", err, "page_id", targetRunbook.ID)
		return
	}

	// Post a message in the thread linking to the updated runbook for PM/L3 review.
	reviewMsg := fmt.Sprintf(
		"📝 *Learnings captured!*\n\n"+
			"I've appended the troubleshooting steps and findings from this thread to the runbook:\n"+
			"• <%s|%s>\n\n"+
			"_⚠️ A Product Manager or L3 engineer should review and verify the additions._",
		targetRunbook.URL, targetRunbook.Title,
	)

	_, _, err = h.slackClient.PostMessageContext(ctx,
		channel,
		slack.MsgOptionText(reviewMsg, false),
		slack.MsgOptionTS(threadTS),
	)
	if err != nil {
		h.logger.Error("failed to post learnings notification", "error", err)
		return
	}

	h.logger.Info("learnings captured and notification posted",
		"runbook", targetRunbook.Title,
		"page_id", targetRunbook.ID,
	)
}

// postErrorReply sends a brief error message to the thread.
func (h *Handler) postErrorReply(channel, threadTS string) {
	_, _, _ = h.slackClient.PostMessage(
		channel,
		slack.MsgOptionText("Sorry, I encountered an error generating a triage response. Please check the logs.", false),
		slack.MsgOptionTS(threadTS),
	)
}
