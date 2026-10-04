import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, jsonResult } from "../result.js";
import type { FinancialSummaryService } from "../../quickbooks/services/financial-summary.service.js";

export function registerFinancialSummaryTool(server: McpServer, summaries: FinancialSummaryService): void {
  server.registerTool(
    "get_customer_financial_summary",
    {
      title: "Customer financial summary",
      description:
        "Build a business summary for one sandbox customer from the customer record and that customer's invoices. Returns invoice count, total invoiced (sum of TotalAmt), total outstanding (sum of Balance), and overdue count/amount. An invoice is overdue when Balance is greater than zero and DueDate is before today (UTC). Amount paid is not returned, because Balance also changes for credits and discounts. The scan reads at most 1000 invoices.",
      inputSchema: {
        customer_id: z.string().describe("Numeric QuickBooks customer id."),
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
        return jsonResult(await summaries.get(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
