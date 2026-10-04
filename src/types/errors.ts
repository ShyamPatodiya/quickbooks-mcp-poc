export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends AppError {}

export class AuthenticationError extends AppError {}

export class TokenRefreshError extends AppError {}

export class ValidationError extends AppError {}

export class WriteDisabledError extends AppError {}

export class MalformedResponseError extends AppError {}

export class QuickBooksApiError extends AppError {
  constructor(
    message: string,
    readonly status: number,
    readonly qboCode?: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends QuickBooksApiError {}
