#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadRuntimeConfig } from "./bootstrap.js";
import { createServer } from "./mcp/server.js";

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("quickbooks-mcp-server listening on stdio (sandbox only)");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Startup failed.";
  console.error(message);
  process.exit(1);
});
