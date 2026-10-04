# Setup

This POC is not production-ready. Live sandbox calls need your own Intuit app. None were run while building this repository.

## Install

Node.js 22 or newer.

```bash
npm install
npm run build
```

## Intuit app

1. Create an app in the Intuit Developer portal.
2. Use the development client id and client secret.
3. Add the redirect URI `http://localhost:8000/callback`.
4. Create or open a QuickBooks Online sandbox company.

## Environment

```bash
copy .env.example .env
```

Set `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET`. Leave the refresh token and realm id empty until authorization.

```bash
npm run auth
```

A browser opens for the sandbox company. On success, `.env` receives `QUICKBOOKS_REFRESH_TOKEN` and `QUICKBOOKS_REALM_ID`. Tokens are not printed. See [quickbooks-auth.md](quickbooks-auth.md).

The server reads `.env` from the project root, even when the process working directory is elsewhere. To use a different file, set `QUICKBOOKS_TOKEN_STORE_PATH` to an absolute path in the process environment before startup.

## Run

```bash
npm start
```

Or, without compiling:

```bash
npm run dev
```

Both speak MCP on stdio. Do not type into the process. Use MCP Inspector or another MCP client.

## MCP Inspector

```bash
npm run build
npm run inspect
```

Inspector should show all six tools listed in [mcp-tools.md](mcp-tools.md). Client id and client secret must already be available. Tool calls that reach QuickBooks also need the refresh token and realm id from `npm run auth`.

## Write lock

To register `create_invoice` but reject it:

```env
QUICKBOOKS_DISABLE_WRITE=true
```

Remove that line, or set it to anything other than `true`, before the sandbox create-invoice check.
