import assert from "node:assert/strict";
import test from "node:test";
import { errorResult } from "../../src/mcp/result.js";
import { ValidationError } from "../../src/types/errors.js";

test("tool failures become MCP errors and do not leak unexpected exception text", () => {
  const validation = errorResult(new ValidationError("customer_id must be a numeric QuickBooks id"));
  assert.equal(validation.isError, true);
  assert.equal(validation.content[0]?.type, "text");
  assert.match(validation.content[0] && "text" in validation.content[0] ? validation.content[0].text : "", /customer_id/);

  const unexpected = errorResult(new Error("Bearer secret-token"));
  assert.equal(unexpected.isError, true);
  const text = unexpected.content[0] && "text" in unexpected.content[0] ? unexpected.content[0].text : "";
  assert.equal(text.includes("secret-token"), false);
});
