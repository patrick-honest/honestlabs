const { execSync } = require("child_process");
const { spawn } = require("child_process");

const child = spawn("npx", ["wrangler", "pages", "dev", "out", "--port", "3000"], {
  cwd: "/Users/patrick/HonestInfoApp/honestlabs",
  stdio: "inherit",
  shell: true,
});

child.on("error", (err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
