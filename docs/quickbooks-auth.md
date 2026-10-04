# QuickBooks sandbox auth

Authorization uses Intuit OAuth 2.0 through `intuit-oauth`, for the sandbox environment only. The login flow follows the reference server's useful behavior (state check, one-time code exchange, refresh-token rotation) without copying that implementation.

## What you configure

| Name | Role |
| --- | --- |
| Client id / secret | Identify the Intuit app. Required to start. |
| Redirect URI | Local callback. Default `http://localhost:8000/callback`. |
| Scope | Accounting. |
| Refresh token | Long-lived token stored in the token file. |
| Access token | Kept in memory. Refreshed shortly before expiry. |
| Realm id | Sandbox company id returned by Intuit. |
| Environment | `sandbox` only. |

## Authorize

```bash
npm run auth
```

The command:

1. Binds `http://localhost:8000/callback` (or the port and path from `QUICKBOOKS_REDIRECT_URI`).
2. Opens the Intuit authorize URL, and also prints it to stderr.
3. Checks the OAuth `state` value.
4. Exchanges the authorization code once.
5. Writes the refresh token and realm id into the token file with file mode `0600` where the platform allows it.

Production keys and a public HTTPS redirect are out of scope. The process refuses `QUICKBOOKS_ENVIRONMENT=production`.

## Refresh

Each QuickBooks call asks `RefreshingTokenProvider` for an access token. One refresh runs at a time. If Intuit rotates the refresh token, the new value is written back to the token file. The access token is not written to disk.

If refresh fails, the tool returns a token-refresh error and the MCP process keeps running. The message tells you to check the app keys and to run `npm run auth` again when the refresh token is no longer valid. The token itself is not included in the message.

## Files

- `src/quickbooks/auth/cli.ts` starts the login.
- `src/quickbooks/auth/login.ts` is the callback server.
- `src/quickbooks/auth/oauth-client.ts` calls `refreshUsingToken`.
- `src/quickbooks/auth/token-provider.ts` caches the access token.
- `src/quickbooks/auth/token-store.ts` updates `.env`.

Do not commit `.env`, refresh tokens, or client secrets.
