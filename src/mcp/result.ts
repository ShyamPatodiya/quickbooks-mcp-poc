import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AppError } from "../types/errors.js";

export function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

export function errorResult(error: unknown): CallToolResult {
  if (!(error instanceof AppError)) {
    console.error("[quickbooks-mcp] tool call failed");
  }
  return {
    isError: true,
    content: [{ type: "text", text: publicMessage(error) }],
  };
}

function publicMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  return "The tool call failed because of an unexpected error.";
}
