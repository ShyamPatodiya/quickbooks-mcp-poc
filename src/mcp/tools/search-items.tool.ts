import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, jsonResult } from "../result.js";
import { parseSearchItems, type ItemService } from "../../quickbooks/services/item.service.js";

export function registerSearchItemsTool(server: McpServer, items: ItemService): void {
  server.registerTool(
    "search_items",
    {
      title: "Search items",
      description:
        "Search QuickBooks Online sandbox products and services by name. Use a returned id as item_id when creating an invoice. Returns id, name, type, description, unit price, and active status. This does not return the raw QuickBooks payload.",
      inputSchema: {
        name: z.string().trim().min(1).max(100).optional().describe("Item name fragment."),
        limit: z.number().int().min(1).max(100).optional().describe("Page size. Defaults to 20."),
        start_position: z.number().int().min(1).max(10_000).optional().describe("1-based QuickBooks start position. Defaults to 1."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        return jsonResult(await items.search(parseSearchItems(args)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
