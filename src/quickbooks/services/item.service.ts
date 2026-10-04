import { z } from "zod";
import type { QuickBooksApi } from "../client/quickbooks-client.js";
import { escapeLikeLiteral } from "../client/query.js";
import { numberOrNull, readEntityList, stringOrNull } from "../client/response.js";
import { MalformedResponseError, ValidationError } from "../../types/errors.js";
import type { ItemSummary, QboItem } from "../../types/quickbooks.js";

export const searchItemsSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    start_position: z.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export type SearchItemsInput = z.infer<typeof searchItemsSchema>;

export interface ItemSearchResult {
  count: number;
  limit: number;
  start_position: number;
  items: ItemSummary[];
}

export class ItemService {
  constructor(private readonly api: QuickBooksApi) {}

  async search(input: SearchItemsInput): Promise<ItemSearchResult> {
    const body = await this.api.query<unknown>(buildItemQuery(input));
    const rows = readEntityList<QboItem>(body, "Item");
    return {
      count: rows.length,
      limit: input.limit,
      start_position: input.start_position,
      items: rows.map(toItemSummary),
    };
  }
}

export function buildItemQuery(input: SearchItemsInput): string {
  const where = input.name ? ` WHERE Name LIKE '%${escapeLikeLiteral(input.name)}%'` : "";
  return `SELECT Id, Name, Type, Description, UnitPrice, Active FROM Item${where} STARTPOSITION ${input.start_position} MAXRESULTS ${input.limit}`;
}

export function parseSearchItems(input: unknown): SearchItemsInput {
  const parsed = searchItemsSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

export function toItemSummary(item: QboItem): ItemSummary {
  if (!item.Id) {
    throw new MalformedResponseError("QuickBooks item response did not include an Id.");
  }
  return {
    id: item.Id,
    name: stringOrNull(item.Name),
    type: stringOrNull(item.Type),
    description: stringOrNull(item.Description),
    unit_price: numberOrNull(item.UnitPrice),
    active: typeof item.Active === "boolean" ? item.Active : null,
  };
}
