# QuickBooks Online MCP POC

This is a proof of concept. It is not production-ready.

It is a small, AI-agnostic MCP server for QuickBooks Online Sandbox. The official Intuit server at [intuit/quickbooks-online-mcp-server](https://github.com/intuit/quickbooks-online-mcp-server) was used as a technical reference and was not copied wholesale. This project does not use `node-quickbooks`.

The POC proves five things:

1. QuickBooks Online Sandbox connectivity.
2. An MCP server on local stdio.
3. Standard customer, item, and invoice tools.
4. One custom business tool, `get_customer_financial_summary`.
5. An architecture that does not depend on Claude, OpenAI, or any other model SDK.

## Architecture

```
AI client
  → MCP (stdio)
    → MCP tool layer
      → QuickBooks service layer
        → QuickBooks API client
          → QuickBooks Online Sandbox
```

See [docs/architecture.md](docs/architecture.md).

## Prerequisites

- Node.js 22 or newer
- An Intuit Developer app with development keys
- Redirect URI `http://localhost:8000/callback`
- A QuickBooks Online sandbox company

Live sandbox calls were not run in this repository. They stay blocked until those Intuit values exist locally.

## Setup

```bash
npm install
copy .env.example .env
```

Fill in `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET`. Then authorize the sandbox company:

```bash
npm run auth
```

That writes `QUICKBOOKS_REFRESH_TOKEN` and `QUICKBOOKS_REALM_ID` into `.env`. The command does not print tokens. Details are in [docs/setup.md](docs/setup.md) and [docs/quickbooks-auth.md](docs/quickbooks-auth.md).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `QUICKBOOKS_CLIENT_ID` | yes | Intuit app client id |
| `QUICKBOOKS_CLIENT_SECRET` | yes | Intuit app secret |
| `QUICKBOOKS_ENVIRONMENT` | yes | Must be `sandbox`. Any other value refuses to start. |
| `QUICKBOOKS_REDIRECT_URI` | no | Defaults to `http://localhost:8000/callback`. Must be an http localhost URL. |
| `QUICKBOOKS_REFRESH_TOKEN` | for API calls | Written by `npm run auth`. |
| `QUICKBOOKS_REALM_ID` | for API calls | Sandbox company id, written by `npm run auth`. |
| `QUICKBOOKS_DISABLE_WRITE` | no | `true` rejects `create_invoice`. |
| `QUICKBOOKS_TOKEN_STORE_PATH` | no | Absolute path to the env file. Set it on the process, not only inside `.env`. |
| `QUICKBOOKS_MINOR_VERSION` | no | QuickBooks minor version. Defaults to `75`. |

`.env` is gitignored. Do not commit secrets.

## Running the server

```bash
npm run build
npm start
```

`npm start` speaks MCP on stdin/stdout. Logs go to stderr. For development without a build, `npm run dev` does the same through `tsx`.

## MCP Inspector

```bash
npm run build
npm run inspect
```

That runs the MCP Inspector against `node dist/index.js`. The server must be able to read `.env` from the project root, or the same variables must be present in the process environment.

The Inspector should list these seven tools:

- `search_customers`
- `get_customer`
- `search_items`
- `search_invoices`
- `get_invoice`
- `create_invoice`
- `get_customer_financial_summary`

Tool arguments and return fields are in [docs/mcp-tools.md](docs/mcp-tools.md).

No Claude, ChatGPT, or Cursor client session was run as part of this implementation. Compatibility with those clients is not claimed.

## Sandbox testing

Unit tests mock QuickBooks and do not need credentials:

```bash
npm test
```

The manual sandbox checklist is in [docs/testing.md](docs/testing.md). Use `search_items` to find a sandbox item id before `create_invoice`. After creation, confirm the invoice in the QuickBooks sandbox UI.

## Limitations

- Sandbox only. Production is rejected at startup.
- One company, stored as a refresh token and realm id in a local env file.
- Local stdio only. There is no remote HTTP transport.
- `create_invoice` is the only write.
- Customer and invoice ids must be numeric QuickBooks ids.
- Financial summary does not report amount paid. Invoice `Balance` also changes when credits or discounts are applied.
- The summary reads at most 1000 invoices per customer.
- Invoice search and the summary use the fields QuickBooks returns for `TotalAmt`, `Balance`, and `DueDate`. Missing amounts are omitted rather than treated as zero.

## Future production work

- A deliberate production configuration, with a public HTTPS OAuth redirect.
- Token storage other than a plaintext env file, including more than one company.
- Streamable HTTP for remote MCP clients, without changing the QuickBooks service layer.
- More tools only after the sandbox path is verified.
- Operational logging that still never prints tokens.
