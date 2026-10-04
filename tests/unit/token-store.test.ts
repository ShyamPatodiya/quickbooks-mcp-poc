import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileTokenStore } from "../../src/quickbooks/auth/token-store.js";

test("updates the refresh token without dropping other env lines", () => {
  const filePath = path.join(os.tmpdir(), `qbo-token-${process.pid}-${Date.now()}.env`);
  fs.writeFileSync(filePath, "QUICKBOOKS_CLIENT_ID=abc\nQUICKBOOKS_REFRESH_TOKEN=old\n", "utf8");
  try {
    const store = new FileTokenStore(filePath);
    store.save({ refreshToken: "rotated", realmId: "462081" });
    const written = fs.readFileSync(filePath, "utf8");
    assert.match(written, /QUICKBOOKS_CLIENT_ID=abc/);
    assert.match(written, /QUICKBOOKS_REFRESH_TOKEN=rotated/);
    assert.match(written, /QUICKBOOKS_REALM_ID=462081/);
    assert.deepEqual(store.read(), { refreshToken: "rotated", realmId: "462081" });
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});
