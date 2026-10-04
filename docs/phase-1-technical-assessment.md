# Phase 1 Technical Assessment

Source: [intuit/quickbooks-online-mcp-server](https://github.com/intuit/quickbooks-online-mcp-server), inspected at commit `31a1dd5` (`main`, 15 Sep 2026, `fix: make tests and CI cross-platform (#136)`).

This repository is a technical reference. It was not copied wholesale, and no application code was added from it.

# 1. Executive Summary

The Intuit QuickBooks Online MCP server is a local, stdio Model Context Protocol server. It exposes QuickBooks Online through `@modelcontextprotocol/sdk` and talks to Intuit with the community `node-quickbooks` client plus official `intuit-oauth`.

The inspected tree has **142 tool modules**, registered from `src/index.ts`. Published docs disagree with that code: the README says 145 tools and `get_invoice`; the changelog and architecture doc say 143 tools; the invoice read tool is actually `read_invoice`.

The protocol is AI-agnostic. The shipping transport is not. It is a stdio subprocess aimed at Claude Code. There is no HTTP, SSE, or streamable-HTTP server in `src`.

For this sandbox POC, build a small server and use the Intuit repo as a reference. Forking it would import 142 tools, a callback-based QuickBooks wrapper, drifting docs, and a license-metadata conflict. The patterns worth copying are the OAuth flow, Zod tool schemas for customers and invoices, and the snake_case-to-QuickBooks field mapping.

# 2. Repository Architecture

Important folders:

| Path | Role |
| --- | --- |
| `src/index.ts` | Process entry. Registers tools and connects stdio. |
| `src/server/qbo-mcp-server.ts` | Singleton `McpServer`. |
| `src/helpers/register-tool.ts` | Registration, CRUD enablement, unknown-parameter warnings. |
| `src/tools/*.tool.ts` | 142 tool definitions (name, description, Zod schema, handler). |
| `src/handlers/*.handler.ts` | QuickBooks calls. One operation per file. |
| `src/clients/quickbooks-client.ts` | OAuth, token refresh, `node-quickbooks` instance. |
| `src/auth-server.ts` | `npm run auth` entry. Calls `quickbooksClient.authenticate()`. |
| `src/helpers/build-quickbooks-search-criteria.ts` | Search criteria normalization. |
| `src/helpers/format-error.ts` | Error string formatting. |
| `src/types/` | `ToolDefinition`, `ToolResponse`, ambient types. |
| `tests/unit/` | 35 `*.test.ts` files. Mocks live in `tests/mocks/`. |
| `docs/ARCHITECTURE.md`, `docs/TESTING.md` | Design notes. Both are behind the code. |
| `.github/workflows/ci.yml` | Node 22 CI: install, build, lint, test. |

`src/index.ts` calls `QuickbooksMCPServer.GetServer()`, then `RegisterTool(...)` for every tool, then `new StdioServerTransport()` and `server.connect(transport)`. Three `RegisterTool` lines in that file are comments, so a raw text count of 145 is not the live tool count.

`docs/ARCHITECTURE.md` still describes `server.tool(...)` calls inside `src/index.ts` and a `quickbooksClient.authenticate()` / `getQuickbooks()` handler shape. The code has moved to `RegisterTool` and `QuickbooksClient.getInstance()`.

# 3. MCP Architecture

- **SDK:** `@modelcontextprotocol/sdk`, declared `^1.26.0`, locked at **1.30.0** (MIT).
- **Server:** `McpServer` in `QuickbooksMCPServer.GetServer()`, name `"QuickBooks Online MCP Server"`, version `"1.0.0"`, capabilities `{ tools: {} }`. Package version in `package.json` is `0.0.1`. Those versions do not match.
- **Transport:** `StdioServerTransport` only. README states this is a local stdio subprocess. No other transport appears in `src`.
- **Tool definition:** `ToolDefinition` in `src/types/tool-definition.ts`: `name`, `description`, Zod `schema`, `handler`.
- **Registration:** `RegisterTool` calls `server.tool(name, description, { params: schema }, handler)`. Inputs are nested under `params`.
- **Validation:** Zod on the registered schema. `RegisterTool` calls `.passthrough()`, strips unknown keys, and prepends a text warning so unknown fields are not silently sent to QuickBooks. `search_invoices` is an exception: its MCP schema is `z.object({ criteria: z.any() })`, and a stricter check runs inside the handler via `RUNTIME_CRITERIA_SCHEMA.safeParse`.
- **Results:** Handlers return `ToolResponse<T>` (`result`, `isError`, `error`) from `src/types/tool-response.ts`. Tool handlers then turn that into MCP `{ content: [{ type: "text", text }] }`. On handler failure they still return text content. The inspected customer and invoice tool handlers do not set the MCP `isError` flag.
- **CRUD gating:** `create_` / `create-` follow `QUICKBOOKS_DISABLE_WRITE`. `update_` / `update-` follow `QUICKBOOKS_DISABLE_UPDATE`. `delete_` / `delete-` follow `QUICKBOOKS_DISABLE_DELETE`. `get_`, `search_`, and `read_` stay registered.
- **AI-agnostic:** Runtime dependencies have no Claude or OpenAI SDK. Any MCP client that can spawn a stdio server can call it. `.github/workflows/claude.yml` is an Anthropic GitHub Action for repo comments. It is not part of the server. The README’s client example is Claude Code only. ChatGPT setup is not documented in the repository.

# 4. QuickBooks Integration

- **Libraries:** `intuit-oauth` 4.2.5 (Apache-2.0) for OAuth. `node-quickbooks` 2.0.50 (ISC, [mcohen01/node-quickbooks](https://github.com/mcohen01/node-quickbooks)) for the Accounting API. This is not Intuit’s official HTTP SDK. The wrapper is callback-based; handlers wrap callbacks in `Promise`.
- **Construction:** `QuickbooksClient.authenticate()` builds `new QuickBooks(clientId, clientSecret, accessToken, false, realmId, environment === "sandbox", false, null, "2.0", refreshToken)`. The `null` minor version means the library default is used. Which minor version is sent is **unknown from this repository**. `docs/ARCHITECTURE.md` names the hosts `sandbox.api.intuit.com` and `api.intuit.com`. Those hosts are chosen inside `node-quickbooks`, not in this repo.
- **Entities:** Handlers pass through the SDK’s PascalCase objects (`CustomerRef`, `Line`, `QueryResponse`). There is no separate domain model. Tool inputs are mostly snake_case and mapped in the handler. `createQuickbooksInvoice` maps `customer_ref` and `line_items` into `CustomerRef` and `SalesItemLineDetail`.
- **Realm ID:** One company. `QUICKBOOKS_REALM_ID` is loaded at startup. The OAuth callback stores `tokens.realmId` through `saveTokensToEnv()`. Every API call uses that single realm on the shared client.
- **Search and pagination:** `buildQuickbooksSearchCriteria` accepts a plain object, a `{ field, value, operator }` array, or advanced options: `filters` / `criteria`, `asc`, `desc`, `limit`, `offset`, `count`, `fetchAll`. Customer search calls `findCustomers`. Invoice search calls `findInvoices` and reads `QueryResponse.Invoice`. `fetchAll` is forwarded to `node-quickbooks`. How that library pages the Query API is **unknown from this repository**.
- **API errors:** The callback `err` goes to `formatError`. An `Error` becomes `Error: ${message}`. A string is prefixed the same way. Anything else is `JSON.stringify`’d. Handlers do not parse Intuit `Fault` / `Error` arrays themselves. Auth failures are separate and thrown from `QuickbooksClient`.

`create_invoice` requires an existing customer id and at least one line with `item_ref`, `qty`, and `unit_price`. The POC tool list has no item tool, so a sandbox item id still has to come from somewhere.

# 5. OAuth & Authentication

Implemented in `src/clients/quickbooks-client.ts`. `src/auth-server.ts` is only a CLI wrapper.

| Piece | Behavior |
| --- | --- |
| Client ID / secret | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`. Missing values throw at import, so the process will not start. |
| Scope | `OAuthClient.scopes.Accounting` only. |
| Access token | Memory only. Refresh 5 minutes before expiry (`TOKEN_REFRESH_BUFFER_MS`). Default lifetime treated as 3600 seconds if `expires_in` is absent. |
| Refresh token | `QUICKBOOKS_REFRESH_TOKEN`. Intuit rotation is persisted. Code comments say refresh tokens last about 100 days and warn under 14 days. |
| Persistence | `saveTokensToEnv()` rewrites the token file. Default path is the package-root `.env` (`dist/clients` → `../../.env`). `QUICKBOOKS_TOKEN_STORE_PATH` overrides it, must be absolute, and is read from the process env before dotenv runs. Writes use mode `0o600`. Non-symlinks use a temp file plus rename. |
| Callback | Interactive flow always uses `http://localhost:8000/callback`, even if `QUICKBOOKS_REDIRECT_URI` differs. Listens on `::`, port 8000. Checks OAuth `state` (`crypto.randomBytes(24)`). Ignores a second callback so the auth code is not exchanged twice. |
| Sandbox vs production | `QUICKBOOKS_ENVIRONMENT` defaults to `sandbox`. Interactive browser login runs only when the environment is not `production`. A dead production refresh token throws `reauthError()` and does not open a browser. |
| Command | `npm run auth` → `node dist/auth-server.js`. |

Security notes from the code:

- Refresh token and client secret sit in a plaintext env file.
- The callback server binds all interfaces on port 8000 for the OAuth window. `state` is checked.
- One process, one realm. A comment says a host can point each process at its own token file. There is no multi-company session inside the server.
- `dotenv.config({ override: true })` lets the token file override empty host env values.
- Module-level `uncaughtException` / `unhandledRejection` handlers log and do not exit.

# 6. Existing Tools

142 tools, from the `toolName` in each `src/tools/*.tool.ts` file. Bill and vendor CRUD use hyphens (`create-bill`, `get-vendor`). Their search tools use underscores (`search_bills`, `search_vendors`). README names such as `create_bill` do not match the code. `RegisterTool` still classifies both separators.

There is no `get_invoice`. The read tool is `read_invoice` with parameter `invoice_id`. `get_customer` uses `id`.

| Entity | Create | Read | Update | Delete | Search |
| --- | --- | --- | --- | --- | --- |
| Customer | `create_customer` | `get_customer` | `update_customer` | `delete_customer` | `search_customers` |
| Invoice | `create_invoice` | `read_invoice`, `get_invoice_pdf` | `update_invoice` | `delete_invoice` | `search_invoices` |
| Estimate | yes | `get_estimate` | yes | yes | yes |
| Payment | yes | `get_payment` | yes | `delete_payment` | yes |
| Bill | `create-bill` | `get-bill` | `update-bill` | `delete-bill` | `search_bills` |
| Vendor | `create-vendor` | `get-vendor` | `update-vendor` | `delete-vendor` | `search_vendors` |
| Bill payment | yes | yes | yes | yes | yes |
| Employee | yes | yes | yes | yes | yes |
| Item | yes | `read_item` | yes | yes | yes |
| Account | yes | `get_account` | yes | none | yes |
| Journal entry | yes | yes | yes | yes | yes |
| Purchase | yes | yes | yes | yes | yes |
| Sales receipt | yes | yes | yes | yes | yes |
| Credit memo | yes | yes | yes | yes | yes |
| Refund receipt | yes | yes | yes | yes | yes |
| Purchase order | yes | yes | yes | yes | yes |
| Vendor credit | yes | yes | yes | yes | yes |
| Deposit | yes | yes | yes | yes | yes |
| Transfer | yes | yes | yes | yes | yes |
| Time activity | yes | yes | yes | yes | yes |
| Class, department, term, payment method | yes | yes | yes | none | yes |
| Tax code, tax rate, tax agency | none | yes | none | none | yes |
| Company info | none | `get_company_info` | `update_company_info` | none | none |
| Preferences | none | `get_preferences` | none | none | none |
| Attachable | yes | yes | yes | yes | yes |
| Budget | none | none | none | none | `search_budgets` |

Reports, all read-only: `get_balance_sheet`, `get_profit_and_loss`, `get_cash_flow`, `get_trial_balance`, `get_general_ledger`, `get_customer_sales`, `get_customer_balance`, `get_aged_receivables`, `get_aged_payables`, `get_vendor_expenses`, `get_vendor_balance`.

Not in the tree, despite README or changelog mentions: `get_invoice`, `get_aged_receivables_detail`, and `src/handlers/get-quickbooks-aged-receivables-detail.handler.ts`. No `send_` tool exists. There is no separate Expense entity. Expenses are the Purchase tools.

Delete is not one QuickBooks operation:

- `deleteQuickbooksInvoice` tries `deleteInvoice`, then `voidInvoice`. The comment says QuickBooks voids invoices.
- `deleteQuickbooksCustomer` tries `deleteCustomer`, then an inactive update. The comment says delete makes the customer inactive.
- `deleteQuickbooksPayment` only calls `deletePayment`. The README calls this a void. The handler does not say that.

`get_invoice_pdf` can return inline base64 or write under `QBO_PDF_OUTPUT_DIR` when that variable is set (README). That variable is not in `.env.example`.

# 7. Technology Stack

| Item | What the repo specifies |
| --- | --- |
| Language | TypeScript, `strict: true`, target ES2020, `module` / `moduleResolution` `NodeNext`. |
| Node | CI uses Node 22 (`.github/workflows/ci.yml`). `package.json` has no `engines` field. No `.nvmrc`. Official minimum is **unknown**. |
| Runtime | `"type": "module"`. Binary is `dist/index.js` with a `#!/usr/bin/env node` shebang. |
| Build | `tsc`, then `shx chmod +x dist/*.js`. `prepare` builds on install. |
| MCP / validation | `@modelcontextprotocol/sdk` 1.30.0, `zod` 3.25.76. |
| QuickBooks | `intuit-oauth` 4.2.5, `node-quickbooks` 2.0.50. `package.json` overrides `fast-xml-parser`, `underscore`, and `uuid` inside `node-quickbooks`. |
| Other runtime deps | `dotenv` 16.x (BSD-2-Clause), `open` 9.x (MIT). |
| Tests | Jest 30 + ts-jest, ESM, `node --experimental-vm-modules`. Coverage gate is 100%, with lower floors for `quickbooks-client.ts` and the account create/update handlers. |
| Lint | ESLint 9 flat config, typescript-eslint, `eslint-config-prettier`. `@typescript-eslint/no-explicit-any` is off. |
| Format | `prettier` 3.5.3 is a devDependency. No Prettier config file is in the tree. |
| Tests run | Unit tests with `tests/mocks/quickbooks.mock.ts`. No live QuickBooks integration suite is in `tests/`. |

Test-count claims disagree and were not re-run here: README says 396 tests; `docs/TESTING.md` and `CHANGELOG.md` say 335. The tree contains 35 `*.test.ts` files. `docs/TESTING.md` says 12 suites.

# 8. Licensing

This is a reading of the files, not legal advice.

The file that governs the repo is `LICENSE`: **Apache License 2.0**, appendix copyright **2025 Intuit, Inc.** GitHub reports SPDX `Apache-2.0`. There is no `NOTICE` file.

The same repo contradicts that:

- `package.json` says `"license": "MIT"`.
- README badge and footer say MIT.

Apache 2.0 sections 2–4 allow use, modification, and distribution of derivative works if license and attribution obligations are met, including retaining notices and stating changes. Section 6 does not grant Intuit trademarks. “QuickBooks” can be used in the ordinary way to describe origin. Shipping a product that presents itself as Intuit’s server is a trademark question, separate from the copyright license.

Third-party licenses that travel with a build:

| Package | License |
| --- | --- |
| `@modelcontextprotocol/sdk` | MIT |
| `zod` | MIT (npm; lockfile has no license field) |
| `intuit-oauth` | Apache-2.0 |
| `node-quickbooks` | ISC |
| `dotenv` | BSD-2-Clause |
| `open` | MIT |

A fork that redistributes this code needs a deliberate choice: follow the Apache-2.0 `LICENSE` file, and do not treat the MIT badge as the license. Trademark and branding still need a decision even if the copyright license allows modification. This POC uses the Intuit repository as a technical reference and does not copy it wholesale.

# 9. Local Setup Requirements

From README, `.env.example`, and the client code:

1. Node 22 is what CI uses. A lower minimum is **unknown**.
2. Clone, `npm install` (this also builds via `prepare`), or `npm run build`.
3. Intuit Developer app. Development keys. Redirect URI exactly `http://localhost:8000/callback`.
4. A QuickBooks Online sandbox company.
5. `.env`:

```env
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_REDIRECT_URI=http://localhost:8000/callback
QUICKBOOKS_REFRESH_TOKEN=
QUICKBOOKS_REALM_ID=
```

6. `npm run auth`. Browser opens, sandbox company is authorized, refresh token and realm id are written into `.env`.
7. Run `node dist/index.js` under an MCP client. The README Claude Code snippet is `command: node`, `args: ["path/to/.../dist/index.js"]`, with the same env vars. Optional `QUICKBOOKS_DISABLE_WRITE`, `QUICKBOOKS_DISABLE_UPDATE`, `QUICKBOOKS_DISABLE_DELETE`.
8. `.env` is resolved from the compiled module location, not the shell cwd, unless `QUICKBOOKS_TOKEN_STORE_PATH` is an absolute path in the host process env.

Production needs a public HTTPS redirect. The README suggests ngrok or a public callback. The in-server interactive flow refuses `environment === "production"`.

# 10. Fork vs Own Implementation

Use a smaller MCP server, with the Intuit repo as the reference. Do not fork and customize the full tree.

| Criterion | Fork and customize | Small server, Intuit as reference |
| --- | --- | --- |
| Effort for 5 tools | Faster first commit, then a long deletion of ~137 tools, handlers, and tests. | More upfront design. The POC surface is five tools plus auth. |
| Maintainability | `src/index.ts` is a manual import list. Bill/vendor names use hyphens. Docs disagree with code. Handlers use `any` and callbacks. | A short tool registry and a typed QuickBooks module stay reviewable. |
| Licensing | Derivative of the Intuit tree. Apache-2.0 obligations apply to the reused code, while `package.json` and README claim MIT. | Dependencies stay MIT / Apache-2.0 / ISC. Intuit copyright applies only to code actually copied. |
| Architecture | Proven stdio server, one realm, tokens in `.env`, `node-quickbooks` callbacks. | Same POC shape, with a token store and HTTP client that can be replaced later. |
| Extensibility | Pattern exists (tool + handler + mock), but every tool is hand-wired. | Add a tool module and one registry line. Client-specific tools do not sit inside 142 generic ones. |
| AI-agnostic | Protocol is. Transport and docs are local stdio / Claude Code. | Keep stdio for the sandbox proof. Add a remote transport later if ChatGPT requires it. |
| Testing | Large Jest suite and 100% gate, with exceptions. No live sandbox tests. | Test the five tools and the auth client. Add a sandbox smoke test when credentials exist. |
| Upgrades | Tracking Intuit `main` means repeated merges across generated-style CRUD files. | Track Intuit for behavior notes (token rotation, invoice payload). Do not merge their tree. |

# 11. Recommended POC Architecture

```
AI client (Claude Desktop/Code, or another MCP client)
        │  MCP, stdio for the first proof
        ▼
Our MCP server
  McpServer + RegisterTool-style modules
  Zod params
  tools: search_customers, get_customer,
         search_invoices, get_invoice, create_invoice
        │
        ▼
QuickBooks service
  intuit-oauth (sandbox)
  thin Accounting API client (query + customer read + invoice create)
  token store interface (file in the POC)
        │
        ▼
QuickBooks Online Sandbox
  one realm id
```

Keep the reference’s tool ideas, not its package:

- `search_customers` and `get_customer` match `src/tools/search-customers.tool.ts` and `get-customer.tool.ts`.
- `search_invoices` matches `src/tools/search-invoices.tool.ts`.
- `get_invoice` is the POC name. The reference equivalent is `read_invoice` (`invoice_id`).
- `create_invoice` matches `src/tools/create-invoice.tool.ts`: `customer_ref`, `line_items[]` of `item_ref`, `qty`, `unit_price`.

Prefer a small REST client over `node-quickbooks` for these five calls. The reference handlers show the payload shape and the OAuth edge cases (refresh rotation, single-flight refresh, sandbox browser fallback). Copy those behaviors into an interface. Leave the other 137 tools out.

Stdio is the right first transport because that is what the reference proves. Keep the server free of Claude- or OpenAI-specific SDKs.

The Intuit repository stays a technical reference. It is not copied wholesale into this POC.

# 12. Risks / Open Questions

- **Online vs Desktop.** This server is QuickBooks Online only. Desktop is not implemented. Confirm the client means Online.
- **Sandbox vs production.** POC should stay `QUICKBOOKS_ENVIRONMENT=sandbox`. Production OAuth cannot use the localhost callback this server starts.
- **Read vs write.** The reference requests the Accounting scope, which is what `create_invoice` needs. Whether the Intuit app is limited to read-only is a portal setting, not something in this repo.
- **Invoice create needs an item.** `create_invoice` requires `item_ref`. The POC list has no item tool. A known sandbox item id, or a later lookup tool, has to be decided before that tool can succeed.
- **Token storage.** Reference storage is a plaintext env file. Confirm that is acceptable for the POC, and whether more than one company must be connected.
- **Multi-user / multi-company.** The reference is one process, one realm, one token file. `QUICKBOOKS_TOKEN_STORE_PATH` is the only multi-tenant hook, and it is per process.
- **Remote vs local.** Stdio works for Claude Desktop and Claude Code. The repo does not implement or document a remote MCP endpoint. Whether ChatGPT can use this stdio server is **unknown from the repository**.
- **Claude vs ChatGPT.** Only Claude Code config is documented. No client SDK is coupled in. A remote transport may still be required for ChatGPT. That requirement is not in this repo.
- **Branding.** Apache-2.0 does not grant Intuit trademarks. Rebranding the server name is a product and trademark decision. The MIT labels in README and `package.json` should not be copied.
- **Client-specific tools.** Unknown until the client lists them. The five POC tools are the only ones specified.
- **Docs drift.** Do not treat README tool names or coverage counts as the source of truth. Use `src/tools` and `src/index.ts`.
- **`node-quickbooks` minor version and error shape.** Not fixed in this repo. **Unknown.**

# 13. Recommended Next Step

Reuse the OAuth design, the five customer/invoice schemas, and the invoice payload mapping. Leave the 142-tool tree, `node-quickbooks`, the MIT license badge, and the Claude Code workflow out of the POC. Use the Intuit repository as a technical reference. Do not copy it wholesale.

Next implementation phase, after the prerequisites below exist: scaffold this repo as a small TypeScript MCP server (stdio, Zod, `intuit-oauth`, a thin sandbox client) and implement only `search_customers`, `get_customer`, `search_invoices`, `get_invoice`, and `create_invoice`, with unit tests against a mocked QuickBooks client.

Obtain these before coding:

1. Intuit Developer account and an app using **development** keys.
2. Client ID and client secret.
3. Redirect URI `http://localhost:8000/callback` on that app.
4. A QuickBooks Online **sandbox** company.
5. Confirmation that the app’s scope can create invoices (Accounting, not read-only).
6. A decision that POC auth is a local `.env` token file and one sandbox realm.
7. A decision that the first client is stdio (Claude Desktop or Claude Code). ChatGPT can wait until remote MCP is required.
8. A sandbox customer and a sandbox item id to use when proving `create_invoice`, or an explicit decision to add a temporary item lookup.
