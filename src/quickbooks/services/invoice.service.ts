import { z } from "zod";
import type { QuickBooksApi } from "../client/quickbooks-client.js";
import { numberOrNull, readEntity, readEntityList, stringOrNull } from "../client/response.js";
import { MalformedResponseError, NotFoundError, ValidationError, WriteDisabledError } from "../../types/errors.js";
import type { InvoiceLineSummary, InvoiceSummary, QboInvoice, QboInvoiceLine } from "../../types/quickbooks.js";

const qboId = z.string().regex(/^\d+$/, "must be a numeric QuickBooks id");

const lineItemSchema = z.object({
  item_id: qboId,
  description: z.string().trim().min(1).max(4000).optional(),
  quantity: z.number().positive().finite(),
  unit_price: z.number().nonnegative().finite(),
});

export const searchInvoicesSchema = z
  .object({
    customer_id: qboId.optional(),
    invoice_id: qboId.optional(),
    limit: z.number().int().min(1).max(100).default(20),
    start_position: z.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const getInvoiceSchema = z
  .object({
    invoice_id: qboId,
  })
  .strict();

export const createInvoiceSchema = z
  .object({
    customer_id: qboId,
    line_items: z.array(lineItemSchema).min(1).max(100),
  })
  .strict();

export type SearchInvoicesInput = z.infer<typeof searchInvoicesSchema>;
export type GetInvoiceInput = z.infer<typeof getInvoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export interface InvoiceSearchResult {
  count: number;
  limit: number;
  start_position: number;
  invoices: InvoiceSummary[];
}

export interface InvoiceCreateBody {
  CustomerRef: { value: string };
  Line: Array<{
    DetailType: "SalesItemLineDetail";
    Amount: number;
    Description?: string;
    SalesItemLineDetail: {
      ItemRef: { value: string };
      Qty: number;
      UnitPrice: number;
    };
  }>;
}

const INVOICE_PAGE_SIZE = 100;
const MAX_INVOICE_PAGES = 10;

export class InvoiceService {
  constructor(
    private readonly api: QuickBooksApi,
    private readonly disableWrite: boolean,
  ) {}

  async search(input: SearchInvoicesInput): Promise<InvoiceSearchResult> {
    const body = await this.api.query<unknown>(buildInvoiceQuery(input));
    const rows = readEntityList<QboInvoice>(body, "Invoice");
    return {
      count: rows.length,
      limit: input.limit,
      start_position: input.start_position,
      invoices: rows.map((invoice) => toInvoiceSummary(invoice, false)),
    };
  }

  async get(input: GetInvoiceInput): Promise<InvoiceSummary> {
    let body: unknown;
    try {
      body = await this.api.get<unknown>("invoice", input.invoice_id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`No invoice was found for id ${input.invoice_id}.`, error.status, error.qboCode);
      }
      throw error;
    }
    return toInvoiceSummary(readEntity<QboInvoice>(body, "Invoice"), true);
  }

  async create(input: CreateInvoiceInput): Promise<InvoiceSummary> {
    if (this.disableWrite) {
      throw new WriteDisabledError("create_invoice is disabled because QUICKBOOKS_DISABLE_WRITE=true.");
    }
    const payload = buildCreateInvoiceBody(input);
    const body = await this.api.post<unknown>("invoice", payload);
    return toInvoiceSummary(readEntity<QboInvoice>(body, "Invoice"), true);
  }

  async listForCustomer(customerId: string): Promise<{ invoices: InvoiceSummary[]; incomplete: boolean }> {
    const invoices: InvoiceSummary[] = [];
    let incomplete = false;
    for (let page = 0; page < MAX_INVOICE_PAGES; page += 1) {
      const start = page * INVOICE_PAGE_SIZE + 1;
      const body = await this.api.query<unknown>(
        buildInvoiceQuery({
          customer_id: customerId,
          limit: INVOICE_PAGE_SIZE,
          start_position: start,
        }),
      );
      const rows = readEntityList<QboInvoice>(body, "Invoice").map((invoice) => toInvoiceSummary(invoice, false));
      invoices.push(...rows);
      if (rows.length < INVOICE_PAGE_SIZE) {
        return { invoices, incomplete: false };
      }
      if (page === MAX_INVOICE_PAGES - 1) {
        incomplete = true;
      }
    }
    return { invoices, incomplete };
  }
}

export function buildInvoiceQuery(input: SearchInvoicesInput): string {
  const filters: string[] = [];
  if (input.customer_id) {
    filters.push(`CustomerRef = '${input.customer_id}'`);
  }
  if (input.invoice_id) {
    filters.push(`Id = '${input.invoice_id}'`);
  }
  const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
  return `SELECT Id, DocNumber, TxnDate, DueDate, CustomerRef, TotalAmt, Balance, CurrencyRef FROM Invoice${where} STARTPOSITION ${input.start_position} MAXRESULTS ${input.limit}`;
}

export function buildCreateInvoiceBody(input: CreateInvoiceInput): InvoiceCreateBody {
  return {
    CustomerRef: { value: input.customer_id },
    Line: input.line_items.map((line) => {
      const row: InvoiceCreateBody["Line"][number] = {
        DetailType: "SalesItemLineDetail",
        Amount: roundMoney(line.quantity * line.unit_price),
        SalesItemLineDetail: {
          ItemRef: { value: line.item_id },
          Qty: line.quantity,
          UnitPrice: line.unit_price,
        },
      };
      if (line.description) {
        row.Description = line.description;
      }
      return row;
    }),
  };
}

export function parseSearchInvoices(input: unknown): SearchInvoicesInput {
  return parse(searchInvoicesSchema, input);
}

export function parseGetInvoice(input: unknown): GetInvoiceInput {
  return parse(getInvoiceSchema, input);
}

export function parseCreateInvoice(input: unknown): CreateInvoiceInput {
  return parse(createInvoiceSchema, input);
}

export function toInvoiceSummary(invoice: QboInvoice, includeLines: boolean): InvoiceSummary {
  if (!invoice.Id) {
    throw new MalformedResponseError("QuickBooks invoice response did not include an Id.");
  }
  const summary: InvoiceSummary = {
    id: invoice.Id,
    doc_number: stringOrNull(invoice.DocNumber),
    customer_id: stringOrNull(invoice.CustomerRef?.value),
    txn_date: stringOrNull(invoice.TxnDate),
    due_date: stringOrNull(invoice.DueDate),
    total_amount: numberOrNull(invoice.TotalAmt),
    balance: numberOrNull(invoice.Balance),
    currency: stringOrNull(invoice.CurrencyRef?.value),
  };
  if (includeLines) {
    summary.line_items = (invoice.Line ?? [])
      .filter((line) => line.DetailType === "SalesItemLineDetail")
      .map(toLineSummary);
  }
  return summary;
}

function toLineSummary(line: QboInvoiceLine): InvoiceLineSummary {
  return {
    description: stringOrNull(line.Description),
    amount: numberOrNull(line.Amount),
    quantity: numberOrNull(line.SalesItemLineDetail?.Qty),
    unit_price: numberOrNull(line.SalesItemLineDetail?.UnitPrice),
    item_id: stringOrNull(line.SalesItemLineDetail?.ItemRef?.value),
  };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
