import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { AuthenticationError, ConfigurationError } from "../../types/errors.js";
import type { AppConfig } from "../../config/env.js";
import type { TokenStore } from "./token-store.js";
import OAuthClient from "intuit-oauth";
import { createOAuthClient } from "./oauth-client.js";

export async function runSandboxLogin(config: AppConfig, store: TokenStore): Promise<void> {
  const target = callbackTarget(config.redirectUri);
  const state = crypto.randomBytes(24).toString("hex");
  const oauth = createOAuthClient(config);
  const authUrl = oauth.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let exchangeStarted = false;
    const finish = (error?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      server.close();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const server = createServer((request, response) => {
      void handleRequest(request, response).catch((error: unknown) => finish(error));
    });

    const timer = setTimeout(() => {
      finish(new AuthenticationError("Timed out waiting for the QuickBooks sandbox callback."));
    }, 5 * 60 * 1000);

    async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
      const requestUrl = new URL(request.url ?? "/", config.redirectUri);
      if (requestUrl.pathname !== target.pathname) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Waiting for the QuickBooks OAuth callback.");
        return;
      }
      if (requestUrl.searchParams.get("state") !== state) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Invalid or missing state.");
        return;
      }
      if (exchangeStarted) {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<p>Authorization is already in progress. You can close this window.</p>");
        return;
      }
      exchangeStarted = true;
      const oauthError = requestUrl.searchParams.get("error");
      if (oauthError) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("QuickBooks did not authorize the connection.");
        finish(new AuthenticationError(`QuickBooks authorization was denied (${oauthError}).`));
        return;
      }

      let tokenResponse;
      try {
        tokenResponse = await oauth.createToken(request.url ?? "");
      } catch {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("QuickBooks authorization failed.");
        finish(
          new AuthenticationError(
            "QuickBooks authorization failed. Check the sandbox app keys and that the redirect URI matches http://localhost:8000/callback.",
          ),
        );
        return;
      }
      const token = tokenResponse.getToken();
      if (!token.refresh_token || !token.realmId) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("QuickBooks did not return a refresh token and company id.");
        finish(new AuthenticationError("QuickBooks did not return a refresh token and company id."));
        return;
      }
      store.save({ refreshToken: token.refresh_token, realmId: token.realmId });
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<p>Sandbox company connected. You can close this window.</p>");
      finish();
    }

    server.on("error", (error) => finish(error));
    server.listen(target.port, "::", () => {
      console.error("Open this URL to authorize the QuickBooks sandbox company:");
      console.error(authUrl);
      openBrowser(authUrl);
    });
  });
}

function callbackTarget(redirectUri: string): { port: number; pathname: string } {
  const url = new URL(redirectUri);
  const port = url.port ? Number(url.port) : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError("QUICKBOOKS_REDIRECT_URI has an invalid port.");
  }
  return { port, pathname: url.pathname };
}

function openBrowser(url: string): void {
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${url}"`], { stdio: "ignore", windowsHide: true })
      : process.platform === "darwin"
        ? spawn("open", [url], { stdio: "ignore" })
        : spawn("xdg-open", [url], { stdio: "ignore" });
  child.on("error", () => {
    console.error("Could not open a browser. Use the authorization URL printed above.");
  });
}
