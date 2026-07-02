import {
  AccessTokenRequest,
  AuthRequest,
  makeRedirectUri,
  RefreshTokenRequest,
  RevokeTokenRequest,
  TokenError,
  TokenResponse,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { createStore } from "zustand";

import { createStorage } from "./storage";
import { type AuthConfig, type AuthSessionInfo, type AuthState } from "./types";

const defaultAuthorizationEndpoint =
  "https://api.workos.com/user_management/authorize";

WebBrowser.maybeCompleteAuthSession();

const emptySession: Partial<AuthSessionInfo> = {
  user: undefined,
  organizationId: undefined,
  impersonator: undefined,
  authenticationMethod: undefined,
};

function assertAuthSessionInfo(
  response: unknown,
): asserts response is AuthSessionInfo {
  if (!response || typeof response !== "object" || !("user" in response)) {
    throw new Error("Invalid authentication response");
  }
}

export function createAuthStore(config: AuthConfig) {
  const {
    clientId = "",
    redirectUri = makeRedirectUri(),
    authorizationEndpoint = defaultAuthorizationEndpoint,
    tokenEndpoint,
    revocationEndpoint,
    storageKeyPrefix = "workos",
    devMode = false,
  } = config;

  if (authorizationEndpoint === defaultAuthorizationEndpoint && !clientId) {
    throw new Error(
      "clientId is required when using default authorizationEndpoint",
    );
  }

  const storage = createStorage(storageKeyPrefix);

  // Warm up the browser for faster sign-in
  WebBrowser.warmUpAsync();

  async function readTokenResponse(): Promise<TokenResponse | null> {
    const stored = await storage.readTokens();
    if (!stored) return null;
    const requestConfig = JSON.parse(stored);
    return new TokenResponse(requestConfig);
  }

  async function storeTokenResponse(
    tokenResponse: TokenResponse,
  ): Promise<Partial<AuthSessionInfo>> {
    assertAuthSessionInfo(tokenResponse.rawResponse);

    const requestConfig = tokenResponse.getRequestConfig();
    const { user, organizationId, impersonator, authenticationMethod } =
      tokenResponse.rawResponse;
    const meta = { user, organizationId, impersonator, authenticationMethod };

    await Promise.all([
      storage.writeTokens(JSON.stringify(requestConfig)),
      storage.writeMeta(JSON.stringify(meta)),
    ]);

    return meta;
  }

  const store = createStore<AuthState>()((set) => {
    // Single-flight refresh: concurrent getAccessToken calls share one
    // in-flight request. WorkOS refresh tokens are single-use, so parallel
    // refreshes race and the loser's invalid_grant is indistinguishable
    // from a revoked session.
    let refreshInFlight: Promise<string> | null = null;

    function refreshSession(tokenResponse: TokenResponse): Promise<string> {
      if (!refreshInFlight) {
        refreshInFlight = (async () => {
          try {
            const refreshTokenRequest = new RefreshTokenRequest({
              refreshToken: tokenResponse.refreshToken,
              clientId,
            });

            const refreshed = await refreshTokenRequest.performAsync({
              tokenEndpoint,
            });

            const meta = await storeTokenResponse(refreshed);
            set(meta);
            return refreshed.accessToken;
          } finally {
            refreshInFlight = null;
          }
        })();
      }
      return refreshInFlight;
    }

    return {
      isLoading: true,

      signIn: async ({ screenHint = "sign-in" } = {}) => {
        const authSessionRequest = new AuthRequest({
          clientId,
          redirectUri,
          extraParams: { provider: "authkit", screen_hint: screenHint },
        });

        const authSessionResult = await authSessionRequest.promptAsync({
          authorizationEndpoint,
        });

        if (authSessionResult.type === "error") {
          throw new Error(
            authSessionResult.error?.description ?? "Unknown error",
          );
        }

        if (authSessionResult.type !== "success") {
          // User cancelled
          return false;
        }

        if (authSessionRequest.state !== authSessionResult.params.state) {
          throw new Error("State mismatch");
        }

        if (!authSessionRequest.codeVerifier) {
          throw new Error("Code verifier missing");
        }

        const tokenRequest = new AccessTokenRequest({
          code: authSessionResult.params.code,
          clientId,
          redirectUri,
          extraParams: {
            code_verifier: authSessionRequest.codeVerifier,
          },
        });

        const tokenResponse = await tokenRequest.performAsync({
          tokenEndpoint,
        });
        const meta = await storeTokenResponse(tokenResponse);
        set(meta);

        return true;
      },

      signOut: async () => {
        try {
          const tokenResponse = await readTokenResponse();
          if (tokenResponse?.accessToken) {
            const revokeTokenRequest = new RevokeTokenRequest({
              clientId,
              token: tokenResponse.accessToken,
            });
            await revokeTokenRequest.performAsync({ revocationEndpoint });
          }
        } catch (error) {
          // Revocation is best-effort (e.g. offline) — always clear locally
          if (devMode) console.error(error);
        } finally {
          await storage.clear();
          set(emptySession);
        }
      },

      getAccessToken: async (options) => {
        const forceRefresh = options?.forceRefresh ?? false;
        try {
          const tokenResponse = await readTokenResponse();

          if (!tokenResponse) {
            await storage.clear();
            set(emptySession);
            return null;
          }

          if (forceRefresh || tokenResponse.shouldRefresh()) {
            try {
              return await refreshSession(tokenResponse);
            } catch (error) {
              // Only an OAuth rejection (e.g. revoked refresh token) means the
              // session is dead. Transient failures — no network, server
              // hiccups — must not sign the user out; keep the session so a
              // later call can retry the refresh.
              if (error instanceof TokenError) throw error;
              if (devMode) console.error(error);
              return TokenResponse.isTokenFresh(tokenResponse)
                ? tokenResponse.accessToken
                : null;
            }
          }

          return tokenResponse.accessToken;
        } catch (error) {
          if (devMode) console.error(error);
          await storage.clear();
          set(emptySession);
          return null;
        }
      },
    };
  });

  // Auto-restore session on creation
  (async () => {
    try {
      const storedMeta = await storage.readMeta();
      if (storedMeta !== null) {
        const meta = JSON.parse(storedMeta);
        store.setState(meta);
      }
      // Refresh access token (also clears if session was revoked)
      await store.getState().getAccessToken({ forceRefresh: true });
    } finally {
      store.setState({ isLoading: false });
    }
  })();

  return store;
}
