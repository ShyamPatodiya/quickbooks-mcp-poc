Add a new MCP tool called `search_items`.

Purpose:
Search QuickBooks Online Sandbox products/services so callers can discover an existing item ID before creating an invoice.

Requirements:
- Follow the existing MCP architecture.
- Add an ItemService rather than putting QuickBooks API calls in the MCP tool.
- Query QuickBooks Online Item entities.
- Support a simple optional name/search parameter and limit.
- Return concise results containing at minimum:
  - id
  - name
  - type
  - description when available
  - unit_price/sales price when available
  - active status when available
- Use Zod validation.
- Normalize the QuickBooks response.
- Add unit tests with mocked QuickBooks API responses.
- Update README/docs/mcp-tools.md.
- Keep the implementation AI-agnostic.
- Do not change existing tools unnecessarily.
- Keep the POC Sandbox-only.
- Run build, lint and tests after implementation.