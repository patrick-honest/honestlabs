# RunbookBot

An on-call incident triage Slack bot that searches Notion runbooks and uses Claude to generate actionable triage responses.

## Prerequisites

- Go 1.22+
- A Slack workspace with admin access
- A Notion workspace with a runbooks database
- An Anthropic API key
- (For deployment) A GKE cluster

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `groups:history`
   - `groups:read`
   - `app_mentions:read`
3. Install the app to your workspace and copy the **Bot User OAuth Token** (`xoxb-...`)

### 2. Enable Socket Mode

1. In your Slack app settings, go to **Socket Mode** and enable it
2. Generate an **App-Level Token** with the `connections:write` scope
3. Copy the token (`xapp-...`)
4. Under **Event Subscriptions**, enable events and subscribe to:
   - `message.channels`
   - `message.groups`
   - `app_mention`

### 3. Set Up Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration
2. Copy the **Internal Integration Token**
3. Share your runbooks database with the integration (click "..." on the database page, then "Add connections")

### 4. Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an API key

### 5. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 6. Run Locally

```bash
go mod tidy
go run .
```

## Deploy to GKE

### Build and Push Docker Image

```bash
# Set your project ID
export PROJECT_ID=your-gcp-project-id

# Build
docker build -t gcr.io/$PROJECT_ID/runbookbot:latest .

# Push
docker push gcr.io/$PROJECT_ID/runbookbot:latest
```

### Deploy to Kubernetes

```bash
# Update the image in deployment.yaml with your PROJECT_ID
sed -i "s/PROJECT_ID/$PROJECT_ID/g" k8s/deployment.yaml

# Create secrets (edit k8s/secret.yaml with real values first)
kubectl apply -f k8s/secret.yaml

# Deploy
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Verify
kubectl get pods -l app=runbookbot
kubectl logs -f deployment/runbookbot
```

## Architecture

- **Socket Mode**: No public endpoint needed -- the bot connects to Slack via WebSocket
- **Notion Search**: Extracts keywords from incident messages and searches runbook titles
- **Claude Triage**: Generates structured incident triage responses referencing matched runbooks
- **Thread Awareness**: Reads full thread context, avoids duplicate replies, provides follow-up advice
