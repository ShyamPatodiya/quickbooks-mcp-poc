#!/usr/bin/env node
import { loadRuntimeConfig } from "../../bootstrap.js";
import { FileTokenStore } from "./token-store.js";
import { runSandboxLogin } from "./login.js";

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const store = new FileTokenStore(config.tokenStorePath);
  console.error("Starting QuickBooks sandbox authorization.");
  await runSandboxLogin(config, store);
  console.error("Sandbox refresh token and company id were saved. Tokens are not printed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Authorization failed.";
  console.error(message);
  process.exit(1);
});
