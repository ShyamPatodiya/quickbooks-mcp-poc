import { AppError, AuthenticationError, MalformedResponseError, NotFoundError, QuickBooksApiError } from "../../types/errors.js";
import type { AppConfig } from "../../config/env.js";

export interface QuickBooksApi {
  query<T>(statement: string): Promise<T>;
  get<T>(entity: "customer" | "invoice", id: string): Promise<T>;
  post<T>(entity: "invoice", body: unknown): Promise<T>;
}

export interface AccessSession {
  getAccessToken(): Promise<string>;
  getRealmId(): string;
}

const ENTITIES = new Set(["customer", "invoice"]);

export class QuickBooksClient implements QuickBooksApi {
  constructor(
    private readonly config: AppConfig,
    private readonly session: AccessSession,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (this.config.environment !== "sandbox") {
      throw new AuthenticationError("QuickBooks client is restricted to the sandbox environment.");
    }
    if (this.config.apiOrigin !== "https://sandbox-quickbooks.api.intuit.com") {
      throw new AuthenticationError("QuickBooks client is restricted to the sandbox API host.");
    }
  }

  query<T>(statement: string): Promise<T> {
    return this.request<T>("GET", "/query", undefined, { query: statement });
  }

  get<T>(entity: "customer" | "invoice", id: string): Promise<T> {
    assertEntity(entity);
    return this.request<T>("GET", `/${entity}/${encodeURIComponent(id)}`);
  }

  post<T>(entity: "invoice", body: unknown): Promise<T> {
    assertEntity(entity);
    return this.request<T>("POST", `/${entity}`, body);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    search?: Record<string, string>,
  ): Promise<T> {
    const accessToken = await this.session.getAccessToken();
    const realmId = this.session.getRealmId();
    const url = new URL(
      `${this.config.apiOrigin}/v3/company/${encodeURIComponent(realmId)}${path}`,
    );
    url.searchParams.set("minorversion", this.config.minorVersion);
    for (const [key, value] of Object.entries(search ?? {})) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new QuickBooksApiError("QuickBooks API request failed before a response was received.", 0);
    }

    const text = await response.text();
    const parsed = parseJson(text);
    if (!response.ok) {
      throw toApiError(response.status, parsed);
    }
    if (parsed === undefined) {
      throw new MalformedResponseError("QuickBooks returned a response that was not JSON.");
    }
    return parsed as T;
  }
}

function assertEntity(entity: string): void {
  if (!ENTITIES.has(entity)) {
    throw new QuickBooksApiError(`Unsupported QuickBooks entity "${entity}".`, 0);
  }
}

function parseJson(text: string): unknown {
  if (!text.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): AppError {
  const fault = readFault(body);
  if (status === 401) {
    return new AuthenticationError(
      "QuickBooks rejected the access token. Run npm run auth if the sandbox connection needs to be authorized again.",
    );
  }
  const message = fault?.message ?? `QuickBooks API request failed with status ${status}.`;
  const detail = fault?.detail ? ` ${fault.detail}` : "";
  const full = `${message}${detail}`.trim();
  if (status === 404 || fault?.code === "610" || /object not found/i.test(full)) {
    return new NotFoundError(full, status, fault?.code);
  }
  return new QuickBooksApiError(full, status, fault?.code);
}

function readFault(body: unknown): { message?: string; detail?: string; code?: string } | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const fault = (body as { Fault?: unknown }).Fault;
  if (!fault || typeof fault !== "object") {
    return undefined;
  }
  const errors = (fault as { Error?: unknown }).Error;
  const first = Array.isArray(errors) ? errors[0] : undefined;
  if (!first || typeof first !== "object") {
    return undefined;
  }
  const record = first as { Message?: unknown; Detail?: unknown; code?: unknown };
  return {
    message: typeof record.Message === "string" ? record.Message : undefined,
    detail: typeof record.Detail === "string" ? record.Detail : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
}
