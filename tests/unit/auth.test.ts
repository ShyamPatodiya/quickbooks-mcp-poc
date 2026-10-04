import assert from "node:assert/strict";
import test from "node:test";
import { RefreshingTokenProvider } from "../../src/quickbooks/auth/token-provider.js";
import { AuthenticationError, TokenRefreshError } from "../../src/types/errors.js";
import type { TokenStore } from "../../src/quickbooks/auth/token-store.js";

const memoryStore = (): TokenStore & { saved: Array<Record<string, string | undefined>> } => {
  const saved: Array<Record<string, string | undefined>> = [];
  return {
    saved,
    read: () => ({}),
    save: (update) => {
      saved.push(update);
    },
  };
};

test("missing refresh token is an authentication error", async () => {
  const provider = new RefreshingTokenProvider(undefined, "1", { refresh: async () => { throw new Error("unused"); } }, memoryStore());
  await assert.rejects(() => provider.getAccessToken(), AuthenticationError);
});

test("refresh failures stay retryable errors and do not expose the token", async () => {
  const provider = new RefreshingTokenProvider(
    "secret-refresh",
    "1",
    { refresh: async () => { throw new Error("status code 400 secret-refresh"); } },
    memoryStore(),
  );
  await assert.rejects(() => provider.getAccessToken(), (error: unknown) => {
    assert.ok(error instanceof TokenRefreshError);
    assert.equal(error.message.includes("secret-refresh"), false);
    return true;
  });
});

test("a rotated refresh token is persisted", async () => {
  const store = memoryStore();
  const provider = new RefreshingTokenProvider(
    "old",
    "1",
    {
      refresh: async () => ({
        accessToken: "access",
        refreshToken: "new",
        expiresIn: 3600,
        realmId: "1",
      }),
    },
    store,
  );
  assert.equal(await provider.getAccessToken(), "access");
  assert.deepEqual(store.saved, [{ refreshToken: "new", realmId: undefined }]);
});
