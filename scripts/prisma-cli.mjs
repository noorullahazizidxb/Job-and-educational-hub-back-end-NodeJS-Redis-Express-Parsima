import { spawn } from "node:child_process";

const [provider, ...args] = process.argv.slice(2);
if (!provider || args.length === 0) {
  console.error("Usage: node ./scripts/prisma-cli.mjs <sqlite|postgresql|mysql> <prisma args...>");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["./node_modules/prisma/build/index.js", ...args],
  {
    env: { ...process.env, DB_PROVIDER: provider },
    stdio: "inherit",
    windowsHide: true,
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
