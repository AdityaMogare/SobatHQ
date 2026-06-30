export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly statusCode = 400,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export class TokenRefreshError extends OAuthError {
  constructor(provider: string, cause?: unknown) {
    super(`Failed to refresh ${provider} token`, provider, 'TOKEN_REFRESH_FAILED', 401, cause);
    this.name = 'TokenRefreshError';
  }
}

export class IntegrationNotConnectedError extends AuthError {
  constructor(provider: string) {
    super(`${provider} is not connected. Please authorize via OAuth.`, 'INTEGRATION_NOT_CONNECTED', 403);
    this.name = 'IntegrationNotConnectedError';
  }
}
