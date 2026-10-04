import assert from "node:assert/strict";
import test from "node:test";
import type { QuickBooksApi } from "../../src/quickbooks/client/quickbooks-client.js";
import { CustomerService } from "../../src/quickbooks/services/customer.service.js";
import { FinancialSummaryService, summarizeCustomerInvoices } from "../../src/quickbooks/services/financial-summary.service.js";
import { InvoiceService } from "../../src/quickbooks/services/invoice.service.js";
import type { InvoiceSummary } from "../../src/types/quickbooks.js";

const customer = { id: "10", display_name: "Ada", active: true };

function invoice(overrides: Partial<InvoiceSummary>): InvoiceSummary {
  return {
    id: "1",
    doc_number: null,
    customer_id: "10",
    txn_date: "2026-01-01",
    due_date: "2026-01-15",
    total_amount: 100,
    balance: 40,
    currency: "USD",
    ...overrides,
  };
}

test("summary totals use TotalAmt and Balance and treats past-due open invoices as overdue", () => {
  const summary = summarizeCustomerInvoices(
    customer,
    [
      invoice({ id: "1", total_amount: 100, balance: 40, due_date: "2026-01-15" }),
      invoice({ id: "2", total_amount: 50, balance: 0, due_date: "2026-01-01" }),
      invoice({ id: "3", total_amount: 25, balance: 25, due_date: "2026-12-01" }),
    ],
    "2026-10-05",
    false,
  );
  assert.equal(summary.invoice_count, 3);
  assert.equal(summary.total_invoiced, 175);
  assert.equal(summary.total_outstanding, 65);
  assert.equal(summary.overdue_invoice_count, 1);
  assert.equal(summary.overdue_amount, 40);
  assert.equal(summary.currency, "USD");
  assert.equal("amount_paid" in summary, false);
  assert.match(summary.limitations.join(" "), /Amount paid is omitted/);
});

test("missing invoice amounts are omitted instead of treated as zero", () => {
  const summary = summarizeCustomerInvoices(
    customer,
    [invoice({ total_amount: null, balance: null, due_date: null })],
    "2026-10-05",
    false,
  );
  assert.equal(summary.total_invoiced, null);
  assert.equal(summary.total_outstanding, null);
  assert.equal(summary.overdue_amount, null);
});

test("the service reads the customer and that customer's invoices", async () => {
  const api: QuickBooksApi = {
    async get() {
      return { Customer: { Id: "10", DisplayName: "Ada", Active: true } };
    },
    async query() {
      return {
        QueryResponse: {
          Invoice: [{ Id: "8", TotalAmt: 10, Balance: 10, DueDate: "2020-01-01", CurrencyRef: { value: "USD" } }],
        },
      };
    },
    async post() {
      throw new Error("not used");
    },
  };
  const summary = await new FinancialSummaryService(
    new CustomerService(api),
    new InvoiceService(api, false),
    () => "2026-10-05",
  ).get({ customer_id: "10" });
  assert.equal(summary.customer.display_name, "Ada");
  assert.equal(summary.invoice_count, 1);
  assert.equal(summary.overdue_amount, 10);
});
