module.exports = {
  apps: [
    {
      name: "honest-review",
      script: "node_modules/.bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: "/Users/patricktanna/Documents/Claude Cowork/business reviews/dashboard",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      // Resource limits
      max_memory_restart: "1G",
    },
  ],
};
