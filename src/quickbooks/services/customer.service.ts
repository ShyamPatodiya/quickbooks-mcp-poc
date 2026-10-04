import { z } from "zod";
import type { QuickBooksApi } from "../client/quickbooks-client.js";
import { escapeLikeLiteral } from "../client/query.js";
import { readEntity, readEntityList, stringOrNull } from "../client/response.js";
import { MalformedResponseError, NotFoundError, ValidationError } from "../../types/errors.js";
import type { CustomerSummary, QboCustomer } from "../../types/quickbooks.js";

const qboId = z.string().regex(/^\d+$/, "must be a numeric QuickBooks id");

export const searchCustomersSchema = z
  .object({
    display_name: z.string().trim().min(1).max(100).optional(),
    active: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    start_position: z.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const getCustomerSchema = z
  .object({
    customer_id: qboId,
  })
  .strict();

export type SearchCustomersInput = z.infer<typeof searchCustomersSchema>;
export type GetCustomerInput = z.infer<typeof getCustomerSchema>;

export interface CustomerSearchResult {
  count: number;
  limit: number;
  start_position: number;
  customers: CustomerSummary[];
}

export class CustomerService {
  constructor(private readonly api: QuickBooksApi) {}

  async search(input: SearchCustomersInput): Promise<CustomerSearchResult> {
    const statement = buildCustomerQuery(input);
    const body = await this.api.query<unknown>(statement);
    const rows = readEntityList<QboCustomer>(body, "Customer");
    return {
      count: rows.length,
      limit: input.limit,
      start_position: input.start_position,
      customers: rows.map(toCustomerSummary),
    };
  }

  async get(input: GetCustomerInput): Promise<CustomerSummary> {
    let body: unknown;
    try {
      body = await this.api.get<unknown>("customer", input.customer_id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`No customer was found for id ${input.customer_id}.`, error.status, error.qboCode);
      }
      throw error;
    }
    return toCustomerSummary(readEntity<QboCustomer>(body, "Customer"));
  }
}

export function buildCustomerQuery(input: SearchCustomersInput): string {
  const filters: string[] = [];
  if (input.display_name) {
    filters.push(`DisplayName LIKE '%${escapeLikeLiteral(input.display_name)}%'`);
  }
  if (input.active !== undefined) {
    filters.push(`Active = ${input.active ? "true" : "false"}`);
  }
  const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
  return `SELECT * FROM Customer${where} STARTPOSITION ${input.start_position} MAXRESULTS ${input.limit}`;
}

export function parseSearchCustomers(input: unknown): SearchCustomersInput {
  return parse(searchCustomersSchema, input);
}

export function parseGetCustomer(input: unknown): GetCustomerInput {
  return parse(getCustomerSchema, input);
}

export function toCustomerSummary(customer: QboCustomer): CustomerSummary {
  if (!customer.Id) {
    throw new MalformedResponseError("QuickBooks customer response did not include an Id.");
  }
  return {
    id: customer.Id,
    display_name: stringOrNull(customer.DisplayName),
    given_name: stringOrNull(customer.GivenName),
    family_name: stringOrNull(customer.FamilyName),
    company_name: stringOrNull(customer.CompanyName),
    email: stringOrNull(customer.PrimaryEmailAddr?.Address),
    phone: stringOrNull(customer.PrimaryPhone?.FreeFormNumber),
    active: typeof customer.Active === "boolean" ? customer.Active : null,
  };
}

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
