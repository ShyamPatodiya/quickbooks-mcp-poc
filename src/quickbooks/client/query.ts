import { ValidationError } from "../../types/errors.js";

export function escapeQueryLiteral(value: string): string {
  if (/[\r\n]/.test(value)) {
    throw new ValidationError("Search text cannot contain line breaks.");
  }
  return value.replaceAll("'", "''");
}

export function escapeLikeLiteral(value: string): string {
  const stripped = escapeQueryLiteral(value).replaceAll(/[%_\\]/g, "");
  if (!stripped.trim()) {
    throw new ValidationError("Search text does not contain any searchable characters.");
  }
  return stripped;
}
