We are now moving from Phase 1 assessment to Phase 2 implementation.

Repository:
quickbooks-mcp-poc

Phase 1 is complete and documented in:
docs/phase-1-technical-assessment.md

REFERENCE IMPLEMENTATION:
https://github.com/intuit/quickbooks-online-mcp-server

IMPORTANT:
We are NOT cloning the entire Intuit implementation.
We are building a small, clean POC and using the Intuit implementation as a technical reference.

The purpose of this POC is to prove:

1. QuickBooks Online Sandbox connectivity.
2. MCP server functionality.
3. Standard QuickBooks tools.
4. Our ability to add custom higher-level business tools.
5. AI-agnostic MCP architecture.

--------------------------------------------------
POC SCOPE
--------------------------------------------------

Implement these QuickBooks tools:

CUSTOMERS
- search_customers
- get_customer

INVOICES
- search_invoices
- get_invoice
- create_invoice

AND ONE CUSTOM BUSINESS TOOL:

- get_customer_financial_summary

The five QuickBooks tools demonstrate direct QuickBooks capabilities.

The custom business tool demonstrates our ability to build additional MCP functionality on top of QuickBooks data rather than merely exposing one-to-one API wrappers.

--------------------------------------------------
ARCHITECTURAL REQUIREMENT
--------------------------------------------------

Use this architecture:

AI Client
    ↓
MCP Protocol
    ↓
MCP Tool Layer
    ↓
QuickBooks Service Layer
    ↓
QuickBooks API Client
    ↓
QuickBooks Online Sandbox

Keep the layers separated.

The MCP layer must not contain raw HTTP/API implementation.

Recommended conceptual structure:

src/
  index.ts

  mcp/
    server.ts
    tools/
      search-customers.tool.ts
      get-customer.tool.ts
      search-invoices.tool.ts
      get-invoice.tool.ts
      create-invoice.tool.ts
      get-customer-financial-summary.tool.ts

  quickbooks/
    auth/
    client/
    services/
      customer.service.ts
      invoice.service.ts
      financial-summary.service.ts

  types/

  config/

The exact folder structure may be adjusted if a better structure is justified, but responsibilities must remain separated.

--------------------------------------------------
TECHNOLOGY
--------------------------------------------------

Use:

- TypeScript
- Node.js
- official Model Context Protocol TypeScript SDK
- Zod
- intuit-oauth
- native fetch or another lightweight HTTP client where appropriate

Do NOT use node-quickbooks unless there is a compelling technical reason.

Phase 1 identified that the Intuit reference implementation uses node-quickbooks, but it is callback-based and the POC should prefer a thin, maintainable API client for the small number of operations being implemented.

Do not add unnecessary frameworks.

--------------------------------------------------
MCP TRANSPORT
--------------------------------------------------

For the POC use local stdio transport.

Do NOT implement remote HTTP transport yet.

However, do not architect the QuickBooks service layer around stdio.

The MCP transport should be replaceable later.

Future architecture may support Streamable HTTP for remote clients.

--------------------------------------------------
AUTHENTICATION
--------------------------------------------------

Implement QuickBooks Online OAuth 2.0 for SANDBOX.

Configuration must come from environment variables.

Expected configuration:

QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_REDIRECT_URI=http://localhost:8000/callback
QUICKBOOKS_REFRESH_TOKEN=
QUICKBOOKS_REALM_ID=

Create:

.env.example

NEVER commit credentials.

.env must be ignored by Git.

Implement/document:
- OAuth authorization
- callback
- access token
- refresh token
- realm/company ID
- sandbox environment

Use the Phase 1 Intuit implementation as a reference for OAuth behavior, especially refresh-token handling.

Do not copy the entire authentication implementation blindly.

--------------------------------------------------
QUICKBOOKS CLIENT
--------------------------------------------------

Create a small QuickBooks API abstraction.

For example:

QuickBooksClient
  - query(...)
  - get(...)
  - post(...)

The service layer should use this abstraction.

Do not scatter QuickBooks HTTP requests throughout MCP tools.

The QuickBooks client should:
- attach authorization
- include realm ID
- target sandbox
- handle HTTP errors
- provide typed/structured responses where practical

Do not hard-code realm IDs, customer IDs, item IDs, URLs, or credentials.

--------------------------------------------------
CUSTOMER TOOLS
--------------------------------------------------

1. search_customers

Purpose:
Search QuickBooks customers.

Inputs should be simple and useful.

At minimum support:
- optional name/query criteria
- pagination/limit where practical

Do not expose unnecessary QuickBooks complexity in the initial POC.

Return concise structured/text output suitable for an LLM.

2. get_customer

Purpose:
Retrieve one customer.

Input:
- customer_id

Return:
- customer identifier
- display name
- company/name fields available
- email/phone when available
- active status when available

Do not dump unnecessary raw API payload.

--------------------------------------------------
INVOICE TOOLS
--------------------------------------------------

3. search_invoices

Purpose:
Search QuickBooks invoices.

Support a small useful subset of search functionality.

At minimum support:
- optional customer_id
- optional invoice identifier
- optional limit

Use the QuickBooks query API appropriately.

4. get_invoice

Purpose:
Retrieve one invoice.

Input:
- invoice_id

IMPORTANT:
The Intuit reference server calls its equivalent read operation `read_invoice`.
Our POC public MCP tool name is intentionally `get_invoice`.

5. create_invoice

Purpose:
Create an invoice in QuickBooks Sandbox.

Inputs should be designed cleanly for an AI tool.

Suggested shape:

{
  customer_id,
  line_items: [
    {
      item_id,
      description?,
      quantity,
      unit_price
    }
  ]
}

Validate all required values with Zod.

Do not accept arbitrary QuickBooks JSON.

Map our clean tool input into the QuickBooks invoice payload.

Do not make the AI aware of QuickBooks SDK-specific object structures such as CustomerRef/Line unless actually necessary.

The Intuit reference implementation confirms that invoice creation requires an existing customer and item reference. Therefore this POC must use a known Sandbox item/customer.

--------------------------------------------------
CUSTOM BUSINESS TOOL
--------------------------------------------------

6. get_customer_financial_summary

This is intentionally OUR custom tool.

Purpose:
Provide a concise business-level summary for one QuickBooks customer.

Input:

{
  customer_id
}

The service should gather the necessary QuickBooks information and calculate/derive a useful summary.

At minimum attempt to provide:

- customer
- invoice count
- total invoiced
- total outstanding
- overdue amount/count where the available QuickBooks data supports this

IMPORTANT:
Do not invent accounting fields.

First inspect the available invoice response structure and determine which values are reliable.

If a field such as payment/settled amount cannot be accurately derived from the available data, do not fabricate it. Either:
- omit it, or
- clearly document the limitation.

This tool should demonstrate an orchestration/business layer.

Conceptually:

MCP:
get_customer_financial_summary
        ↓
FinancialSummaryService
        ↓
CustomerService + InvoiceService
        ↓
QuickBooks API

Do not implement the calculation directly in the MCP handler.

--------------------------------------------------
WRITE SAFETY
--------------------------------------------------

create_invoice is the only write operation in this POC.

The entire POC must remain configured for QuickBooks Sandbox.

Add an explicit configuration guard so production is not accidentally used during development.

If appropriate, support:

QUICKBOOKS_DISABLE_WRITE=true

but the POC must ultimately be tested with create_invoice enabled against Sandbox.

Never expose credentials or tokens through MCP responses.

--------------------------------------------------
ERROR HANDLING
--------------------------------------------------

Implement clear errors for:

- missing environment variables
- invalid customer ID
- invalid invoice input
- missing item ID
- QuickBooks authentication failure
- token refresh failure
- QuickBooks HTTP/API failure
- malformed QuickBooks responses

Do not crash the entire MCP server because a single tool call fails.

Return concise MCP-compatible errors.

--------------------------------------------------
TESTING
--------------------------------------------------

Create unit tests for:

- customer search
- customer retrieval
- invoice search
- invoice retrieval
- invoice creation payload mapping
- financial summary calculation
- validation failures
- QuickBooks API errors
- authentication/configuration failures

Mock the QuickBooks API client.

Unit tests must NOT require live QuickBooks credentials.

Also create a clear separation between:
- unit tests
- Sandbox integration/smoke tests

--------------------------------------------------
SANDBOX SMOKE TEST
--------------------------------------------------

Create documentation for manually validating:

1. Search customer
2. Get customer
3. Search invoices
4. Get invoice
5. Create invoice
6. Get customer financial summary

For create_invoice:

Use an actual Sandbox customer ID and item ID.

After creation, verify the invoice exists directly in QuickBooks Sandbox.

--------------------------------------------------
MCP INSPECTOR
--------------------------------------------------

Make the server compatible with MCP Inspector for local testing.

Document how to start the server and inspect/discover the six tools.

Expected tools:

search_customers
get_customer
search_invoices
get_invoice
create_invoice
get_customer_financial_summary

--------------------------------------------------
AI-AGNOSTIC DESIGN
--------------------------------------------------

There must be no Claude-specific or OpenAI-specific business logic.

Do NOT install:
- Anthropic SDK
- OpenAI SDK

just to implement the MCP server.

Claude, ChatGPT, Cursor, or another client should all interact through MCP.

The architecture must remain:

AI Client
    ↓
MCP
    ↓
Our Server
    ↓
QuickBooks

The MCP server must not know which AI model is calling it.

--------------------------------------------------
DOCUMENTATION
--------------------------------------------------

Create/update:

README.md
docs/architecture.md
docs/setup.md
docs/quickbooks-auth.md
docs/mcp-tools.md
docs/testing.md

README must include:
- project purpose
- architecture
- prerequisites
- setup
- environment variables
- running the server
- MCP Inspector
- tool list
- Sandbox testing
- limitations
- future production work

Document that this POC is not production-ready.

--------------------------------------------------
GIT / PROJECT HYGIENE
--------------------------------------------------

Do not commit:
- .env
- secrets
- tokens
- generated credentials
- QuickBooks production credentials

Ensure .gitignore covers them.

Keep changes focused and readable.

--------------------------------------------------
IMPLEMENTATION WORKFLOW
--------------------------------------------------

Work incrementally.

STEP 1:
Inspect the existing repository state and Phase 1 assessment.

STEP 2:
Scaffold the TypeScript project and configuration.

STEP 3:
Implement configuration + QuickBooks client abstraction.

STEP 4:
Implement OAuth/authentication.

STEP 5:
Implement customer services/tools.

STEP 6:
Implement invoice services/tools.

STEP 7:
Implement get_customer_financial_summary.

STEP 8:
Add unit tests.

STEP 9:
Add MCP Inspector/local execution support.

STEP 10:
Add Sandbox integration/smoke-test documentation.

IMPORTANT:
After each major phase, run build/lint/tests and fix issues before continuing.

Do not generate one enormous implementation in a single step.

--------------------------------------------------
WHEN PREREQUISITES ARE MISSING
--------------------------------------------------

If Intuit credentials or Sandbox access are not yet available:

Do NOT fabricate credentials or claim live QuickBooks connectivity.

Continue with:
- project scaffolding
- QuickBooks client abstraction
- mocked tests
- OAuth implementation
- MCP tools
- documentation

Clearly report that live Sandbox verification is blocked by missing Intuit prerequisites.

--------------------------------------------------
FINAL OUTPUT
--------------------------------------------------

When implementation is complete, report:

1. Files created/modified
2. Architecture implemented
3. Six MCP tools
4. Authentication implementation
5. Tests and results
6. MCP Inspector instructions
7. Sandbox integration status
8. Known limitations
9. Production gaps
10. Recommended next step

Do not claim Claude or ChatGPT compatibility was tested unless an actual MCP client test was performed.