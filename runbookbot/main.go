package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/slack-go/slack"
	"github.com/slack-go/slack/socketmode"

	"github.com/honestbank/runbookbot/bot"
	"github.com/honestbank/runbookbot/claude"
	"github.com/honestbank/runbookbot/config"
	"github.com/honestbank/runbookbot/notion"
)

func main() {
	// Load configuration.
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Set up structured logger.
	logLevel := slog.LevelInfo
	switch cfg.LogLevel {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
	slog.SetDefault(logger)

	logger.Info("starting runbookbot",
		"channel_id", cfg.SlackChannelID,
		"notion_db_id", cfg.NotionDBID,
	)

	// Start health check server.
	go startHealthServer(cfg.HealthPort, logger)

	// Initialize Slack client with Socket Mode.
	slackClient := slack.New(
		cfg.SlackBotToken,
		slack.OptionAppLevelToken(cfg.SlackAppToken),
	)

	socketClient := socketmode.New(
		slackClient,
		socketmode.OptionLog(slog.NewLogLogger(logger.Handler(), slog.LevelDebug)),
	)

	// Initialize Notion client.
	notionClient := notion.NewClient(cfg.NotionAPIKey, cfg.NotionDBID, logger)

	// Initialize Claude client.
	claudeClient := claude.NewClient(logger)

	// Create the event handler.
	handler, err := bot.NewHandler(
		slackClient,
		socketClient,
		notionClient,
		claudeClient,
		cfg.SlackChannelID,
		logger,
	)
	if err != nil {
		logger.Error("failed to create handler", "error", err)
		os.Exit(1)
	}

	// Set up graceful shutdown.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		logger.Info("received shutdown signal", "signal", sig)
		cancel()
	}()

	// Run the bot (blocks until context is cancelled).
	logger.Info("runbookbot is running")
	if err := handler.Run(ctx); err != nil {
		logger.Error("bot stopped with error", "error", err)
		os.Exit(1)
	}

	logger.Info("runbookbot shut down gracefully")
}

// startHealthServer runs a simple HTTP server for liveness/readiness probes.
func startHealthServer(port string, logger *slog.Logger) {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	addr := ":" + port
	logger.Info("health server starting", "addr", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		logger.Error("health server error", "error", err)
	}
}
