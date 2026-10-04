import OAuthClient from "intuit-oauth";
import type { AppConfig } from "../../config/env.js";
import { TokenRefreshError } from "../../types/errors.js";
import type { TokenRefresher, TokenSet } from "./token-provider.js";

export class IntuitTokenRefresher implements TokenRefresher {
  constructor(private readonly config: Pick<AppConfig, "clientId" | "clientSecret" | "redirectUri">) {}

  async refresh(refreshToken: string): Promise<TokenSet> {
    const client = new OAuthClient({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      environment: "sandbox",
      redirectUri: this.config.redirectUri,
    });
    try {
      const response = await client.refreshUsingToken(refreshToken);
      const token = response.getToken();
      if (!token.access_token) {
        throw new TokenRefreshError("QuickBooks token refresh returned no access token.");
      }
      return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || refreshToken,
        expiresIn: token.expires_in || 3600,
        realmId: token.realmId,
      };
    } catch (error) {
      if (error instanceof TokenRefreshError) {
        throw error;
      }
      throw new TokenRefreshError(
        "QuickBooks token refresh failed. Check the client id, client secret, and refresh token, then run npm run auth if the refresh token has expired.",
      );
    }
  }
}

export function createOAuthClient(config: Pick<AppConfig, "clientId" | "clientSecret" | "redirectUri">): OAuthClient {
  return new OAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    environment: "sandbox",
    redirectUri: config.redirectUri,
  });
}
