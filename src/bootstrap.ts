import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { loadConfig, type AppConfig } from "./config/env.js";
import { ConfigurationError } from "./types/errors.js";

export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function loadRuntimeConfig(): AppConfig {
  const root = packageRoot();
  const requested = process.env.QUICKBOOKS_TOKEN_STORE_PATH?.trim();
  if (requested && !path.isAbsolute(requested)) {
    throw new ConfigurationError(
      "QUICKBOOKS_TOKEN_STORE_PATH must be an absolute path set in the process environment.",
    );
  }
  const envFile = requested || path.join(root, ".env");
  dotenv.config({ path: envFile, override: true });
  return loadConfig(process.env, { packageRoot: root });
}
