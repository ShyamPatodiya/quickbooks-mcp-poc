import { MalformedResponseError } from "../../types/errors.js";

export interface QboQueryBody {
  QueryResponse?: Record<string, unknown>;
}

export function readEntityList<T>(body: unknown, key: string): T[] {
  if (!body || typeof body !== "object" || !("QueryResponse" in body)) {
    throw new MalformedResponseError("QuickBooks query response did not include QueryResponse.");
  }
  const queryResponse = (body as QboQueryBody).QueryResponse;
  if (!queryResponse || typeof queryResponse !== "object") {
    throw new MalformedResponseError("QuickBooks query response was empty.");
  }
  const value = queryResponse[key];
  if (value === undefined) {
    return [];
  }
  const rows = Array.isArray(value) ? value : [value];
  return rows as T[];
}

export function readEntity<T>(body: unknown, key: string): T {
  if (!body || typeof body !== "object" || !(key in body)) {
    throw new MalformedResponseError(`QuickBooks response did not include ${key}.`);
  }
  const value = (body as Record<string, unknown>)[key];
  if (!value || typeof value !== "object") {
    throw new MalformedResponseError(`QuickBooks ${key} response was empty.`);
  }
  return value as T;
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
