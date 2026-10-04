import { AuthenticationError, TokenRefreshError } from "../../types/errors.js";
import type { TokenStore } from "./token-store.js";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  realmId?: string;
}

export interface TokenRefresher {
  refresh(refreshToken: string): Promise<TokenSet>;
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export class RefreshingTokenProvider {
  private accessToken?: string;
  private expiresAt = 0;
  private inFlight?: Promise<string>;

  constructor(
    private refreshToken: string | undefined,
    private realmId: string | undefined,
    private readonly refresher: TokenRefresher,
    private readonly store: TokenStore,
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) {
      return this.accessToken;
    }
    if (!this.inFlight) {
      this.inFlight = this.refresh().finally(() => {
        this.inFlight = undefined;
      });
    }
    return this.inFlight;
  }

  getRealmId(): string {
    if (!this.realmId) {
      throw new AuthenticationError(
        "QUICKBOOKS_REALM_ID is not set. Run npm run auth and choose a sandbox company.",
      );
    }
    return this.realmId;
  }

  private async refresh(): Promise<string> {
    if (!this.refreshToken) {
      throw new AuthenticationError(
        "QuickBooks is not authorized. Set QUICKBOOKS_REFRESH_TOKEN or run npm run auth.",
      );
    }
    let token: TokenSet;
    try {
      token = await this.refresher.refresh(this.refreshToken);
    } catch (error) {
      if (error instanceof TokenRefreshError || error instanceof AuthenticationError) {
        throw error;
      }
      throw new TokenRefreshError(
        "QuickBooks token refresh failed. Check the client id, client secret, and refresh token, then run npm run auth if the refresh token has expired.",
      );
    }
    if (!token.accessToken) {
      throw new TokenRefreshError("QuickBooks token refresh returned no access token.");
    }

    this.accessToken = token.accessToken;
    const lifetimeMs = Math.max(1, token.expiresIn) * 1000;
    const bufferMs = Math.min(REFRESH_BUFFER_MS, Math.floor(lifetimeMs / 2));
    this.expiresAt = Date.now() + lifetimeMs - bufferMs;

    const rotated = token.refreshToken && token.refreshToken !== this.refreshToken;
    const realmChanged = Boolean(token.realmId && token.realmId !== this.realmId);
    if (rotated) {
      this.refreshToken = token.refreshToken;
    }
    if (token.realmId) {
      this.realmId = token.realmId;
    }
    if (rotated || realmChanged) {
      this.store.save({
        refreshToken: rotated ? token.refreshToken : undefined,
        realmId: realmChanged ? token.realmId : undefined,
      });
    }
    return token.accessToken;
  }
}
