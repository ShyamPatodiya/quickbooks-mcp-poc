import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, jsonResult } from "../result.js";
import { parseGetCustomer, type CustomerService } from "../../quickbooks/services/customer.service.js";

export function registerGetCustomerTool(server: McpServer, customers: CustomerService): void {
  server.registerTool(
    "get_customer",
    {
      title: "Get customer",
      description:
        "Get one QuickBooks Online sandbox customer by id. Returns the id, names, company, email, phone, and active flag when QuickBooks provides them.",
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
        return jsonResult(await customers.get(parseGetCustomer(args)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
