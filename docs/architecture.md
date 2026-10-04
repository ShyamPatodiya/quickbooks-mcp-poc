# Architecture

This POC is not production-ready. The Intuit QuickBooks Online MCP server is a reference for OAuth behavior and for the customer/invoice payload shape. Its tree was not copied.

```
AI client
  → MCP protocol (stdio transport)
    → MCP tool layer (src/mcp)
      → QuickBooks service layer (src/quickbooks/services)
        → QuickBooks API client (src/quickbooks/client)
          → QuickBooks Online Sandbox
```

The transport is replaceable. Services do not know about stdio. A later Streamable HTTP transport can call the same services.

## Layers

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Load config, connect `StdioServerTransport`. |
| `src/mcp/server.ts` | Register the six tools. |
| `src/mcp/tools/` | Zod inputs, MCP results, calls into services. No QuickBooks HTTP. |
| `src/quickbooks/services/customer.service.ts` | Customer search and read. |
| `src/quickbooks/services/invoice.service.ts` | Invoice search, read, and create payload mapping. |
| `src/quickbooks/services/financial-summary.service.ts` | Custom summary. Uses the customer and invoice services. |
| `src/quickbooks/client/quickbooks-client.ts` | `query`, `get`, and `post` against the sandbox host. |
| `src/quickbooks/auth/` | OAuth login, refresh, and token file updates. |
| `src/config/env.ts` | Environment parsing and the sandbox guard. |

## Custom tool

`get_customer_financial_summary` is not a one-to-one QuickBooks endpoint.

```
get_customer_financial_summary
  → FinancialSummaryService
    → CustomerService.get
    → InvoiceService.listForCustomer
      → QuickBooks API
```

The MCP handler does not calculate totals.

## AI-agnostic

Runtime dependencies are the MCP TypeScript SDK, Zod, `intuit-oauth`, and `dotenv`. There is no Anthropic SDK and no OpenAI SDK. The server does not read which model called a tool.

## Sandbox guard

`QUICKBOOKS_ENVIRONMENT` must be `sandbox` or empty (empty defaults to sandbox). Any other value throws before the server listens. The API client only calls `https://sandbox-quickbooks.api.intuit.com`.

`QUICKBOOKS_DISABLE_WRITE=true` makes `create_invoice` return an error before any POST.
