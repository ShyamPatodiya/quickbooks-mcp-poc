import path from "node:path";
import { ConfigurationError } from "../types/errors.js";

export interface AppConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox";
  redirectUri: string;
  refreshToken?: string;
  realmId?: string;
  disableWrite: boolean;
  minorVersion: string;
  tokenStorePath: string;
  apiOrigin: string;
}

export const SANDBOX_API_ORIGIN = "https://sandbox-quickbooks.api.intuit.com";
const DEFAULT_REDIRECT_URI = "http://localhost:8000/callback";
const DEFAULT_MINOR_VERSION = "75";

export function loadConfig(
  env: NodeJS.ProcessEnv,
  options: { packageRoot: string },
): AppConfig {
  const environment = (env.QUICKBOOKS_ENVIRONMENT ?? "sandbox").trim();
  if (environment !== "sandbox") {
    throw new ConfigurationError(
      `QUICKBOOKS_ENVIRONMENT must be "sandbox" for this POC. Refusing to start with "${environment}".`,
    );
  }

  const clientId = required(env, "QUICKBOOKS_CLIENT_ID");
  const clientSecret = required(env, "QUICKBOOKS_CLIENT_SECRET");
  const redirectUri = (env.QUICKBOOKS_REDIRECT_URI ?? DEFAULT_REDIRECT_URI).trim();
  validateRedirectUri(redirectUri);

  const minorVersion = (env.QUICKBOOKS_MINOR_VERSION ?? DEFAULT_MINOR_VERSION).trim();
  if (!/^\d{1,4}$/.test(minorVersion)) {
    throw new ConfigurationError("QUICKBOOKS_MINOR_VERSION must be a numeric QuickBooks minor version.");
  }

  const tokenStorePath = resolveTokenStorePath(env, options.packageRoot);
  const refreshToken = optional(env, "QUICKBOOKS_REFRESH_TOKEN");
  const realmId = optional(env, "QUICKBOOKS_REALM_ID");
  if (realmId && !/^\d+$/.test(realmId)) {
    throw new ConfigurationError("QUICKBOOKS_REALM_ID must be a numeric company id.");
  }

  return {
    clientId,
    clientSecret,
    environment: "sandbox",
    redirectUri,
    refreshToken,
    realmId,
    disableWrite: env.QUICKBOOKS_DISABLE_WRITE === "true",
    minorVersion,
    tokenStorePath,
    apiOrigin: SANDBOX_API_ORIGIN,
  };
}

export function resolveTokenStorePath(env: NodeJS.ProcessEnv, packageRoot: string): string {
  const requested = env.QUICKBOOKS_TOKEN_STORE_PATH?.trim();
  if (!requested) {
    return path.join(packageRoot, ".env");
  }
  if (!path.isAbsolute(requested)) {
    throw new ConfigurationError(
      "QUICKBOOKS_TOKEN_STORE_PATH must be an absolute path set in the process environment.",
    );
  }
  return requested;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigurationError(`${name} is required.`);
  }
  return value;
}

function optional(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function validateRedirectUri(redirectUri: string): void {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new ConfigurationError("QUICKBOOKS_REDIRECT_URI is not a valid URL.");
  }
  if (url.protocol !== "http:") {
    throw new ConfigurationError("QUICKBOOKS_REDIRECT_URI must use http for the local sandbox callback.");
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new ConfigurationError("QUICKBOOKS_REDIRECT_URI host must be localhost for this POC.");
  }
  if (!url.pathname || url.pathname === "/") {
    throw new ConfigurationError("QUICKBOOKS_REDIRECT_URI must include a callback path.");
  }
}
