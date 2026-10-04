import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../config/env.js";
import { FileTokenStore } from "../quickbooks/auth/token-store.js";
import { IntuitTokenRefresher } from "../quickbooks/auth/oauth-client.js";
import { RefreshingTokenProvider } from "../quickbooks/auth/token-provider.js";
import { QuickBooksClient } from "../quickbooks/client/quickbooks-client.js";
import { CustomerService } from "../quickbooks/services/customer.service.js";
import { InvoiceService } from "../quickbooks/services/invoice.service.js";
import { FinancialSummaryService } from "../quickbooks/services/financial-summary.service.js";
import { registerSearchCustomersTool } from "./tools/search-customers.tool.js";
import { registerGetCustomerTool } from "./tools/get-customer.tool.js";
import { registerSearchInvoicesTool } from "./tools/search-invoices.tool.js";
import { registerGetInvoiceTool } from "./tools/get-invoice.tool.js";
import { registerCreateInvoiceTool } from "./tools/create-invoice.tool.js";
import { registerFinancialSummaryTool } from "./tools/get-customer-financial-summary.tool.js";

export function createServer(config: AppConfig): McpServer {
  const store = new FileTokenStore(config.tokenStorePath);
  const stored = store.read();
  const session = new RefreshingTokenProvider(
    config.refreshToken ?? stored.refreshToken,
    config.realmId ?? stored.realmId,
    new IntuitTokenRefresher(config),
    store,
  );
  const api = new QuickBooksClient(config, session);
  const customers = new CustomerService(api);
  const invoices = new InvoiceService(api, config.disableWrite);
  const summaries = new FinancialSummaryService(customers, invoices);

  const server = new McpServer({
    name: "quickbooks-mcp-server",
    version: "0.1.0",
  });
  registerSearchCustomersTool(server, customers);
  registerGetCustomerTool(server, customers);
  registerSearchInvoicesTool(server, invoices);
  registerGetInvoiceTool(server, invoices);
  registerCreateInvoiceTool(server, invoices);
  registerFinancialSummaryTool(server, summaries);
  return server;
}
