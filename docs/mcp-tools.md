# MCP tools

All six tools are available to any MCP client over stdio. They do not accept raw QuickBooks documents. Ids are numeric QuickBooks ids.

## search_customers

Search customers.

| Input | Required | Notes |
| --- | --- | --- |
| `display_name` | no | Fragment matched with `LIKE` against `DisplayName`. |
| `active` | no | `true` or `false`. |
| `limit` | no | 1–100. Default 20. |
| `start_position` | no | 1-based. Default 1. |

Returns `count`, `limit`, `start_position`, and `customers`. Each customer includes `id`, `display_name`, `given_name`, `family_name`, `company_name`, `email`, `phone`, and `active`. Missing QuickBooks fields are `null`.

## get_customer

| Input | Required |
| --- | --- |
| `customer_id` | yes |

Returns the same customer fields as search, for one customer.

## search_invoices

| Input | Required | Notes |
| --- | --- | --- |
| `customer_id` | no | Filters `CustomerRef`. |
| `invoice_id` | no | Filters invoice `Id`. |
| `limit` | no | 1–100. Default 20. |
| `start_position` | no | 1-based. Default 1. |

Returns `count`, `limit`, `start_position`, and `invoices` with `id`, `doc_number`, `customer_id`, `txn_date`, `due_date`, `total_amount`, `balance`, and `currency`.

## get_invoice

The reference server names the equivalent read `read_invoice`. This POC's public name is `get_invoice`.

| Input | Required |
| --- | --- |
| `invoice_id` | yes |

Returns the invoice fields above plus `line_items` for `SalesItemLineDetail` lines (`description`, `amount`, `quantity`, `unit_price`, `item_id`).

## create_invoice

The only write. It creates an invoice in the sandbox company. The customer and every item must already exist. This server does not look up a default item.

```json
{
  "customer_id": "123",
  "line_items": [
    {
      "item_id": "456",
      "description": "Consulting",
      "quantity": 2,
      "unit_price": 10.5
    }
  ]
}
```

`description` is optional. `quantity` must be greater than zero. `unit_price` must be zero or greater. At least one line is required.

The service maps that input to QuickBooks `CustomerRef` and `SalesItemLineDetail`. Callers do not send those objects.

When `QUICKBOOKS_DISABLE_WRITE=true`, the tool returns an error and does not POST.

## get_customer_financial_summary

Custom tool. Input is `customer_id`.

The service loads the customer, then pages that customer's invoices (100 per page, at most 1000).

| Field | Source |
| --- | --- |
| `customer` | Customer id, display name, active flag. |
| `invoice_count` | Invoices read for that customer. |
| `total_invoiced` | Sum of invoice `TotalAmt`. `null` if any invoice omits it. |
| `total_outstanding` | Sum of invoice `Balance`. `null` if any invoice omits it. |
| `overdue_invoice_count` | Open invoices whose `DueDate` is before today (UTC). |
| `overdue_amount` | Sum of `Balance` for those overdue invoices. |
| `currency` | The shared currency, or `null` when the invoices do not agree. |
| `limitations` | Explains omitted fields. |

An invoice counts as overdue only when `Balance` is greater than zero and `DueDate` is a `YYYY-MM-DD` date before today. Invoices with no due date are not called overdue.

Amount paid is not returned. `Balance` is the open amount, and credits or discounts can change it, so it is not a payment total.

## Errors

A failed tool returns MCP `isError` with a short message. The process keeps running. Covered cases include missing configuration, invalid ids, missing line items, authentication failure, token refresh failure, QuickBooks HTTP faults, and malformed JSON.
