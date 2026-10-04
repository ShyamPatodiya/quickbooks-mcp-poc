import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../../src/config/env.js";
import { ConfigurationError } from "../../src/types/errors.js";

const packageRoot = "C:\\quickbooks-mcp-poc";

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    QUICKBOOKS_CLIENT_ID: "client-id",
    QUICKBOOKS_CLIENT_SECRET: "client-secret",
    ...overrides,
  };
}

test("requires client id and secret", () => {
  assert.throws(() => loadConfig({}, { packageRoot }), ConfigurationError);
});

test("rejects production so sandbox stays the only target", () => {
  assert.throws(
    () => loadConfig(baseEnv({ QUICKBOOKS_ENVIRONMENT: "production" }), { packageRoot }),
    /must be "sandbox"/,
  );
});

test("defaults to sandbox and disables write only for the exact true flag", () => {
  const config = loadConfig(baseEnv({ QUICKBOOKS_DISABLE_WRITE: "false" }), { packageRoot });
  assert.equal(config.environment, "sandbox");
  assert.equal(config.disableWrite, false);
  assert.equal(config.apiOrigin, "https://sandbox-quickbooks.api.intuit.com");
  assert.equal(config.redirectUri, "http://localhost:8000/callback");
});

test("honors the write lock and an absolute token store path", () => {
  const config = loadConfig(
    baseEnv({
      QUICKBOOKS_DISABLE_WRITE: "true",
      QUICKBOOKS_TOKEN_STORE_PATH: "C:\\secrets\\qbo.env",
      QUICKBOOKS_REALM_ID: "123",
    }),
    { packageRoot },
  );
  assert.equal(config.disableWrite, true);
  assert.equal(config.tokenStorePath, "C:\\secrets\\qbo.env");
  assert.equal(config.realmId, "123");
});

test("rejects a relative token store path and a non-localhost redirect", () => {
  assert.throws(
    () => loadConfig(baseEnv({ QUICKBOOKS_TOKEN_STORE_PATH: "relative.env" }), { packageRoot }),
    /absolute path/,
  );
  assert.throws(
    () => loadConfig(baseEnv({ QUICKBOOKS_REDIRECT_URI: "http://example.com/callback" }), { packageRoot }),
    /localhost/,
  );
});
