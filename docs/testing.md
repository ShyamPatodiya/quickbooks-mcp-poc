# Testing

Unit tests and sandbox checks are separate. `npm test` never calls QuickBooks and does not need credentials.

## Unit tests

```bash
npm test
npm run lint
npm run build
```

Unit tests live in `tests/unit/`. They mock the QuickBooks API client or call pure helpers. They cover:

- customer search and retrieval
- invoice search and retrieval
- invoice create payload mapping
- financial summary totals, overdue invoices, and omitted amounts
- validation failures
- QuickBooks API errors
- missing configuration, the production guard, and token refresh failure

`tests/sandbox/` is not part of `npm test`. It only points at the manual checklist below.

## MCP Inspector

```bash
npm run build
npm run inspect
```

Confirm the tool list is exactly:

1. `search_customers`
2. `get_customer`
3. `search_items`
4. `search_invoices`
5. `get_invoice`
6. `create_invoice`
7. `get_customer_financial_summary`

The POC was validated against a live QuickBooks Online Sandbox company through MCP Inspector, after `npm run auth`.

## Completed sandbox validation

MCP Inspector successfully validated:

- OAuth authentication
- `search_customers`
- `get_customer`
- `search_items`
- `search_invoices`
- `create_invoice`
- `get_invoice`
- `get_customer_financial_summary`

Claude and ChatGPT were not part of that validation. `npm test` remains mocked and does not call QuickBooks.

## Sandbox smoke test

Prerequisites: development keys in `.env`, `npm run auth` completed, and `QUICKBOOKS_DISABLE_WRITE` unset. Use ids from your sandbox company. Do not invent them.

1. **Search customer.** Call `search_customers` with a `display_name` you can see in the sandbox. Note a returned `id`.
2. **Get customer.** Call `get_customer` with that `customer_id`. The display name should match the sandbox customer.
3. **Search invoices.** Call `search_invoices` with that `customer_id`. Note an `id`, or continue at step 5 if the customer has no invoices yet.
4. **Get invoice.** Call `get_invoice` with that `invoice_id`. Document number and total should match the invoice in QuickBooks.
5. **Create invoice.** Call `search_items` and copy an `id` from the sandbox product list. Call `create_invoice` with the sandbox `customer_id` and that `item_id`.

```json
{
  "customer_id": "<sandbox customer id>",
  "line_items": [
    {
      "item_id": "<sandbox item id>",
      "description": "POC sandbox invoice",
      "quantity": 1,
      "unit_price": 1
    }
  ]
}
```

6. **Verify in QuickBooks.** Open the sandbox company in the browser and confirm the new invoice exists with that customer, item, and amount. Do not treat the tool response alone as proof.
7. **Financial summary.** Call `get_customer_financial_summary` with the same `customer_id`. `invoice_count` should include the new invoice. `total_outstanding` should include its `Balance`. Compare the figures to the invoices you can see in the sandbox. Read `limitations` before treating a null total as zero.

If a tool returns an authentication or refresh error, run `npm run auth` again. If `create_invoice` says writes are disabled, remove `QUICKBOOKS_DISABLE_WRITE=true`.

## What this validation does not cover

The live check was MCP Inspector against one QuickBooks Online Sandbox company. It does not cover Claude, ChatGPT, a remote MCP transport, or production QuickBooks.
