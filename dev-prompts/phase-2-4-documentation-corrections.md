Update docs/testing.md to accurately reflect the completed POC validation.

The POC has now been tested against a live QuickBooks Online Sandbox using MCP Inspector.

Document that the following were successfully validated:
- OAuth authentication
- search_customers
- get_customer
- search_items
- search_invoices
- create_invoice
- get_invoice
- get_customer_financial_summary

Do not change application code.
Do not change architecture.
Do not modify test behavior.

Then run:
npm test
npm run lint
npm run build