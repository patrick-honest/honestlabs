package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds all configuration for the runbookbot.
type Config struct {
	SlackBotToken   string
	SlackAppToken   string
	AnthropicAPIKey string
	GeminiAPIKey    string
	LLMProvider     string // "claude" (default) or "gemini"
	NotionAPIKey    string
	NotionDBID      string
	SlackChannelID  string
	LogLevel        string
	HealthPort      string
}

// Load reads configuration from environment variables and returns a Config.
// Required variables cause an error if missing; optional ones use defaults.
func Load() (*Config, error) {
	cfg := &Config{
		SlackBotToken:   os.Getenv("SLACK_BOT_TOKEN"),
		SlackAppToken:   os.Getenv("SLACK_APP_TOKEN"),
		AnthropicAPIKey: os.Getenv("ANTHROPIC_API_KEY"),
		GeminiAPIKey:    os.Getenv("GEMINI_API_KEY"),
		LLMProvider:     getEnvOrDefault("LLM_PROVIDER", "claude"),
		NotionAPIKey:    os.Getenv("NOTION_API_KEY"),
		NotionDBID:      getEnvOrDefault("NOTION_DATABASE_ID", "dc28849a-42b5-47f6-abc6-15385afbf57f"),
		SlackChannelID:  getEnvOrDefault("SLACK_CHANNEL_ID", "C0ALJE5SDL6"),
		LogLevel:        getEnvOrDefault("LOG_LEVEL", "info"),
		HealthPort:      getEnvOrDefault("HEALTH_PORT", "8080"),
	}

	var missing []string
	if cfg.SlackBotToken == "" {
		missing = append(missing, "SLACK_BOT_TOKEN")
	}
	if cfg.SlackAppToken == "" {
		missing = append(missing, "SLACK_APP_TOKEN")
	}
	if cfg.NotionAPIKey == "" {
		missing = append(missing, "NOTION_API_KEY")
	}

	switch cfg.LLMProvider {
	case "claude":
		if cfg.AnthropicAPIKey == "" {
			missing = append(missing, "ANTHROPIC_API_KEY")
		}
	case "gemini":
		if cfg.GeminiAPIKey == "" {
			missing = append(missing, "GEMINI_API_KEY")
		}
	default:
		return nil, fmt.Errorf("unknown LLM_PROVIDER %q: must be \"claude\" or \"gemini\"", cfg.LLMProvider)
	}

	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required environment variables: %s", strings.Join(missing, ", "))
	}

	return cfg, nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != ""  {
		return v
	}
	return defaultVal
}
