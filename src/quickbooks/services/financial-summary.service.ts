import { parseGetCustomer, type CustomerService } from "./customer.service.js";
import type { InvoiceService } from "./invoice.service.js";
import type { CustomerFinancialSummary, InvoiceSummary } from "../../types/quickbooks.js";
import { roundMoney } from "./invoice.service.js";

const PAID_AMOUNT_LIMITATION =
  "Amount paid is omitted. Invoice Balance is the open amount, and it also changes when credits or discounts are applied, so it is not a reliable payment total.";

const SCAN_LIMITATION =
  "Totals include only the first 1000 invoices for this customer. The sandbox company has more invoices than this scan reads.";

export class FinancialSummaryService {
  constructor(
    private readonly customers: CustomerService,
    private readonly invoices: InvoiceService,
    private readonly today: () => string = utcToday,
  ) {}

  async get(input: unknown): Promise<CustomerFinancialSummary> {
    const { customer_id: customerId } = parseGetCustomer(input);
    const customer = await this.customers.get({ customer_id: customerId });
    const scan = await this.invoices.listForCustomer(customerId);
    return summarizeCustomerInvoices(customer, scan.invoices, this.today(), scan.incomplete);
  }
}

export function summarizeCustomerInvoices(
  customer: { id: string; display_name: string | null; active: boolean | null },
  invoices: InvoiceSummary[],
  today: string,
  incomplete: boolean,
): CustomerFinancialSummary {
  const limitations = [PAID_AMOUNT_LIMITATION];
  if (incomplete) {
    limitations.push(SCAN_LIMITATION);
  }

  let invoicedCents = 0;
  let outstandingCents = 0;
  let overdueCents = 0;
  let overdueCount = 0;
  let invoicedComplete = true;
  let outstandingComplete = true;
  let overdueComplete = true;
  const currencies = new Set<string>();

  for (const invoice of invoices) {
    if (invoice.currency) {
      currencies.add(invoice.currency);
    }
    if (invoice.total_amount === null) {
      invoicedComplete = false;
    } else {
      invoicedCents += toCents(invoice.total_amount);
    }
    if (invoice.balance === null) {
      outstandingComplete = false;
      overdueComplete = false;
      continue;
    }
    outstandingCents += toCents(invoice.balance);
    if (invoice.balance > 0 && isOverdue(invoice.due_date, today)) {
      overdueCount += 1;
      overdueCents += toCents(invoice.balance);
    } else if (invoice.balance > 0 && invoice.due_date && !isIsoDate(invoice.due_date)) {
      overdueComplete = false;
    }
  }

  if (!invoicedComplete) {
    limitations.push("total_invoiced is omitted because at least one invoice did not include TotalAmt.");
  }
  if (!outstandingComplete) {
    limitations.push("total_outstanding is omitted because at least one invoice did not include Balance.");
  }
  if (!overdueComplete) {
    limitations.push(
      "overdue_amount is omitted, and overdue_invoice_count includes only invoices with a readable due date and balance.",
    );
  }
  if (currencies.size > 1) {
    limitations.push("currency is omitted because the invoices do not share one currency.");
  }

  return {
    customer: {
      id: customer.id,
      display_name: customer.display_name,
      active: customer.active,
    },
    invoice_count: invoices.length,
    total_invoiced: invoicedComplete ? fromCents(invoicedCents) : null,
    total_outstanding: outstandingComplete ? fromCents(outstandingCents) : null,
    overdue_invoice_count: overdueCount,
    overdue_amount: overdueComplete ? fromCents(overdueCents) : null,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    limitations,
  };
}

function isOverdue(dueDate: string | null, today: string): boolean {
  return Boolean(dueDate && isIsoDate(dueDate) && dueDate < today);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toCents(value: number): number {
  return Math.round(roundMoney(value) * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
