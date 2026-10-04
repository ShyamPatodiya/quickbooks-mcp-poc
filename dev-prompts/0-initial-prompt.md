We have created a new repository called `quickbooks-mcp-poc`.

This repository is for a Proof of Concept to build an AI-agnostic QuickBooks Online MCP server.

IMPORTANT:
Do NOT start implementing the POC yet.
Do NOT create production code yet.
Do NOT blindly copy the Intuit repository.

Our immediate goal is to perform a technical discovery/assessment of the official Intuit QuickBooks Online MCP Server and determine the best implementation approach for our POC.

REFERENCE:
https://github.com/intuit/quickbooks-online-mcp-server

CONTEXT

The eventual client requirement is approximately:

- Build/customize a QuickBooks MCP server.
- Allow MCP-compatible AI clients such as Claude and ChatGPT/OpenAI to use QuickBooks capabilities.
- Start from an existing/free QuickBooks MCP implementation if appropriate.
- Add additional tools later.
- Remove/rebrand existing branding where legally/technically permitted.
- Deliver the customized source code.
- Keep the MCP server AI-agnostic rather than coupling it to one AI vendor.

For this POC we only want to prove the architecture with QuickBooks Online Sandbox.

YOUR TASK — PHASE 1 ONLY

Thoroughly inspect the official Intuit QuickBooks Online MCP Server repository and produce a technical assessment.

Do not modify our repository except optionally creating a temporary notes file if absolutely necessary. Prefer reporting the findings in your response first.

Analyze the following:

1. Repository structure
   - Important folders
   - Main entry points
   - MCP server initialization
   - Tool registration
   - QuickBooks integration
   - OAuth/authentication
   - Configuration
   - Tests
   - Documentation

2. MCP architecture
   - MCP SDK being used
   - MCP server implementation
   - Transport currently used
   - How tools are defined
   - How tool inputs are validated
   - How tool results/errors are returned
   - Whether the architecture is AI-agnostic

3. QuickBooks integration
   - Which QuickBooks API/SDK is used
   - How requests are constructed
   - How entities are represented
   - How company/realm ID is handled
   - How pagination/search works
   - How QuickBooks API errors are handled

4. Authentication
   - Intuit OAuth flow
   - Client ID/secret usage
   - Access token
   - Refresh token
   - Token persistence/storage
   - OAuth callback
   - Sandbox vs production configuration
   - Any security concerns

5. Existing MCP tools
   Categorize the currently available tools by entity, for example:
   - Customers
   - Invoices
   - Payments
   - Vendors
   - Items
   - Expenses
   - Accounts
   - Reports
   - etc.

   Identify which tools are:
   - Read/search
   - Create
   - Update
   - Delete/void/send/etc.

6. Technology stack
   - Node version requirements
   - TypeScript configuration
   - Dependencies
   - Build system
   - Test framework
   - Linting/formatting

7. Licensing
   - Identify the current repository license.
   - Determine what it appears to permit regarding modification, redistribution, rebranding, and derivative work.
   - Explicitly distinguish technical feasibility from legal advice.
   - Identify any third-party packages/assets with separate licenses that could affect redistribution/rebranding.

8. Local development
   Determine exactly what is required to run the reference implementation locally:
   - prerequisites
   - environment variables
   - Intuit Developer app
   - QuickBooks Sandbox
   - OAuth setup
   - commands
   - MCP client configuration

9. POC suitability

Evaluate whether we should:

A. Directly fork/customize the Intuit implementation

OR

B. Build our own smaller MCP server using the Intuit repository as a reference

Compare both approaches on:
- development effort
- maintainability
- licensing
- architecture
- future extensibility
- ability to add client-specific tools
- AI-agnostic design
- testing
- upgrade strategy

10. Recommended POC architecture

Propose a minimal architecture for our repository:

AI Client
   ↓
MCP Protocol
   ↓
Our MCP Server
   ↓
QuickBooks Service/API Layer
   ↓
QuickBooks Online Sandbox

The POC should eventually contain only these initial tools:

Customers:
- search_customers
- get_customer

Invoices:
- search_invoices
- get_invoice
- create_invoice

Do NOT implement them yet.

11. Risks / unknowns

Identify anything we still need to clarify before development, especially:
- QuickBooks Online vs Desktop
- Sandbox vs production
- read vs write permissions
- token storage
- multi-user/multi-company requirements
- remote vs local MCP
- Claude vs ChatGPT integration
- branding/rebranding
- client-specific tool requirements

12. Final recommendation

Conclude with:

- What we should reuse
- What we should not reuse blindly
- Recommended POC architecture
- Recommended next implementation phase
- Exact prerequisites I need to obtain before coding

OUTPUT FORMAT

Return the assessment with these headings:

# 1. Executive Summary
# 2. Repository Architecture
# 3. MCP Architecture
# 4. QuickBooks Integration
# 5. OAuth & Authentication
# 6. Existing Tools
# 7. Technology Stack
# 8. Licensing
# 9. Local Setup Requirements
# 10. Fork vs Own Implementation
# 11. Recommended POC Architecture
# 12. Risks / Open Questions
# 13. Recommended Next Step

Be specific and reference actual files/classes/functions from the inspected repository whenever possible.

Do not invent anything.
If something cannot be verified from the repository, explicitly mark it as unknown.