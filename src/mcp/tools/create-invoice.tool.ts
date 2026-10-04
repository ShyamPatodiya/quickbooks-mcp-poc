import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, jsonResult } from "../result.js";
import { parseCreateInvoice, type InvoiceService } from "../../quickbooks/services/invoice.service.js";

export function registerCreateInvoiceTool(server: McpServer, invoices: InvoiceService): void {
  server.registerTool(
    "create_invoice",
    {
      title: "Create invoice",
      description:
        "Create one invoice in the QuickBooks Online sandbox company. Requires an existing customer_id and an existing item_id on every line. This is the only write tool. It fails when QUICKBOOKS_DISABLE_WRITE=true.",
      inputSchema: {
        customer_id: z.string().describe("Numeric QuickBooks customer id."),
        line_items: z
          .array(
            z.object({
              item_id: z.string().describe("Numeric QuickBooks item id."),
              description: z.string().optional().describe("Optional line description."),
              quantity: z.number().positive().describe("Quantity greater than zero."),
              unit_price: z.number().nonnegative().describe("Price for one unit."),
            }),
          )
          .min(1)
          .describe("At least one sales line."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        return jsonResult(await invoices.create(parseCreateInvoice(args)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
