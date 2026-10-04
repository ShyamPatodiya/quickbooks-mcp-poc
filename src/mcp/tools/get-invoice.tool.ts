import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, jsonResult } from "../result.js";
import { parseGetInvoice, type InvoiceService } from "../../quickbooks/services/invoice.service.js";

export function registerGetInvoiceTool(server: McpServer, invoices: InvoiceService): void {
  server.registerTool(
    "get_invoice",
    {
      title: "Get invoice",
      description:
        "Get one QuickBooks Online sandbox invoice by id, including sales-item lines. The public tool name is get_invoice.",
      inputSchema: {
        invoice_id: z.string().describe("Numeric QuickBooks invoice id."),
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
        return jsonResult(await invoices.get(parseGetInvoice(args)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
