import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, jsonResult } from "../result.js";
import { parseSearchInvoices, type InvoiceService } from "../../quickbooks/services/invoice.service.js";

export function registerSearchInvoicesTool(server: McpServer, invoices: InvoiceService): void {
  server.registerTool(
    "search_invoices",
    {
      title: "Search invoices",
      description:
        "Search QuickBooks Online sandbox invoices. Filter by customer id, invoice id, or both. Returns a short page with document number, dates, total, and open balance.",
      inputSchema: {
        customer_id: z.string().optional().describe("Numeric QuickBooks customer id."),
        invoice_id: z.string().optional().describe("Numeric QuickBooks invoice id."),
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
        return jsonResult(await invoices.search(parseSearchInvoices(args)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
