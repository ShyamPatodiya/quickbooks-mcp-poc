import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, jsonResult } from "../result.js";
import { parseSearchCustomers, type CustomerService } from "../../quickbooks/services/customer.service.js";

export function registerSearchCustomersTool(server: McpServer, customers: CustomerService): void {
  server.registerTool(
    "search_customers",
    {
      title: "Search customers",
      description:
        "Search QuickBooks Online sandbox customers by display name and active status. Returns a short page of customers. This does not return the raw QuickBooks payload.",
      inputSchema: {
        display_name: z.string().trim().min(1).max(100).optional().describe("Case-sensitive display name fragment."),
        active: z.boolean().optional().describe("When set, only active or inactive customers are returned."),
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
        return jsonResult(await customers.search(parseSearchCustomers(args)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
