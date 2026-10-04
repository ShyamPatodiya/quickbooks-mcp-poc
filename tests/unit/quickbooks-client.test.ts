import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../../src/config/env.js";
import { QuickBooksClient } from "../../src/quickbooks/client/quickbooks-client.js";
import { AuthenticationError, MalformedResponseError, NotFoundError, QuickBooksApiError } from "../../src/types/errors.js";

const config: AppConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  environment: "sandbox",
  redirectUri: "http://localhost:8000/callback",
  refreshToken: "refresh",
  realmId: "999",
  disableWrite: false,
  minorVersion: "75",
  tokenStorePath: "C:\\unused\\.env",
  apiOrigin: "https://sandbox-quickbooks.api.intuit.com",
};

const session = {
  async getAccessToken(): Promise<string> {
    return "access-token";
  },
  getRealmId(): string {
    return "999";
  },
};

test("query uses the sandbox host, realm, bearer token, and minor version", async () => {
  let seen = "";
  let authorization = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    seen = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(JSON.stringify({ QueryResponse: {} }), { status: 200 });
  };
  const client = new QuickBooksClient(config, session, fetchImpl);
  await client.query("SELECT * FROM Customer");
  const url = new URL(seen);
  assert.equal(url.origin, "https://sandbox-quickbooks.api.intuit.com");
  assert.equal(url.pathname, "/v3/company/999/query");
  assert.equal(url.searchParams.get("minorversion"), "75");
  assert.equal(url.searchParams.get("query"), "SELECT * FROM Customer");
  assert.equal(authorization, "Bearer access-token");
});

test("API faults become structured errors and 401 is an authentication failure", async () => {
  const client = new QuickBooksClient(config, session, async () =>
    new Response(JSON.stringify({ Fault: { Error: [{ Message: "Object Not Found", Detail: "missing", code: "610" }] } }), {
      status: 400,
    }),
  );
  await assert.rejects(() => client.get("customer", "5"), NotFoundError);

  const unauthorized = new QuickBooksClient(config, session, async () => new Response("{}", { status: 401 }));
  await assert.rejects(() => unauthorized.get("customer", "5"), AuthenticationError);
});

test("a non-JSON success body is a malformed response", async () => {
  const client = new QuickBooksClient(config, session, async () => new Response("nope", { status: 200 }));
  await assert.rejects(() => client.get("invoice", "5"), MalformedResponseError);
});

test("transport failures do not include the access token", async () => {
  const client = new QuickBooksClient(config, session, async () => {
    throw new Error("socket hang up access-token");
  });
  await assert.rejects(() => client.post("invoice", { Line: [] }), (error: unknown) => {
    assert.ok(error instanceof QuickBooksApiError);
    assert.equal(error.message.includes("access-token"), false);
    return true;
  });
});
