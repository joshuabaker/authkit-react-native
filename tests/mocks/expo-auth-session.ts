import { vi } from "vitest";

export const makeRedirectUri = vi.fn().mockReturnValue("exp://test");

// Track last created instance of each class so tests can configure behavior
export const __lastInstance: {
  authRequest?: AuthRequest;
  accessTokenRequest?: AccessTokenRequest;
  refreshTokenRequest?: RefreshTokenRequest;
  revokeTokenRequest?: RevokeTokenRequest;
  tokenResponse?: TokenResponse;
} = {};

// Default behaviors tests can override
export const __defaults = {
  promptAsync: vi.fn(),
  accessTokenPerformAsync: vi.fn(),
  refreshTokenPerformAsync: vi.fn(),
  revokeTokenPerformAsync: vi.fn(),
  shouldRefresh: vi.fn().mockReturnValue(false),
  codeVerifier: "test-code-verifier" as string | undefined,
};

export class AuthRequest {
  state = "test-state";
  codeVerifier: string | undefined = __defaults.codeVerifier;

  constructor(public config: Record<string, unknown>) {
    __lastInstance.authRequest = this;
  }

  promptAsync(...args: unknown[]) {
    return __defaults.promptAsync(...args);
  }
}

export class AccessTokenRequest {
  constructor(public config: Record<string, unknown>) {
    __lastInstance.accessTokenRequest = this;
  }

  performAsync(...args: unknown[]) {
    return __defaults.accessTokenPerformAsync(...args);
  }
}

export class RefreshTokenRequest {
  constructor(public config: Record<string, unknown>) {
    __lastInstance.refreshTokenRequest = this;
  }

  performAsync(...args: unknown[]) {
    return __defaults.refreshTokenPerformAsync(...args);
  }
}

export class RevokeTokenRequest {
  constructor(public config: Record<string, unknown>) {
    __lastInstance.revokeTokenRequest = this;
  }

  performAsync(...args: unknown[]) {
    return __defaults.revokeTokenPerformAsync(...args);
  }
}

export class TokenResponse {
  accessToken: string;
  refreshToken: string | undefined;
  rawResponse: Record<string, unknown> | undefined;

  constructor(config: Record<string, unknown>) {
    this.accessToken = (config.accessToken as string) ?? "access-token";
    this.refreshToken = (config.refreshToken as string) ?? "refresh-token";
    this.rawResponse = config.rawResponse as
      | Record<string, unknown>
      | undefined;
    __lastInstance.tokenResponse = this;
  }

  getRequestConfig() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      rawResponse: this.rawResponse,
    };
  }

  shouldRefresh() {
    return __defaults.shouldRefresh();
  }
}
