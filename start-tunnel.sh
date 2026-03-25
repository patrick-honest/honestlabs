#!/bin/bash
# Start Cloudflare quick tunnel and update NEXTAUTH_URL automatically
# Usage: ./start-tunnel.sh

DASHBOARD_DIR="/Users/patricktanna/Documents/Claude Cowork/business reviews/dashboard"
PM2="/opt/homebrew/Cellar/node/25.6.1/lib/node_modules/pm2/bin/pm2"
ENV_FILE="$DASHBOARD_DIR/.env.local"
LOG_FILE="$DASHBOARD_DIR/logs/tunnel.log"

echo "🚀 Starting Honest Business Review..."

# 1. Make sure pm2 server is running
echo "  → Starting Next.js server via pm2..."
cd "$DASHBOARD_DIR"
$PM2 start ecosystem.config.js 2>/dev/null || $PM2 restart honest-review 2>/dev/null
sleep 2

# 2. Kill any existing cloudflared tunnel
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1

# 3. Start quick tunnel and capture the URL
echo "  → Starting Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:3000 > "$LOG_FILE" 2>&1 &
TUNNEL_PID=$!

# Wait for URL to appear in logs
for i in $(seq 1 15); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "  ✗ Failed to get tunnel URL. Check $LOG_FILE"
  exit 1
fi

# 4. Update NEXTAUTH_URL in .env.local
sed -i '' "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"$TUNNEL_URL\"|" "$ENV_FILE"
echo "  → Updated NEXTAUTH_URL to $TUNNEL_URL"

# 5. Rebuild and restart
echo "  → Rebuilding for production..."
cd "$DASHBOARD_DIR"
npm run build --silent 2>/dev/null
$PM2 restart honest-review 2>/dev/null

echo ""
echo "✅ Dashboard is live at:"
echo ""
echo "   $TUNNEL_URL"
echo ""
echo "   Login: Honest User / Honest0123"
echo ""
echo "   Tunnel PID: $TUNNEL_PID"
echo "   To stop: kill $TUNNEL_PID && pm2 stop honest-review"
