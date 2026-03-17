import {
  AccessTokenRequest,
  AuthRequest,
  makeRedirectUri,
  RefreshTokenRequest,
  RevokeTokenRequest,
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

  const store = createStore<AuthState>()((set) => ({
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

      const tokenResponse = await tokenRequest.performAsync({ tokenEndpoint });
      const meta = await storeTokenResponse(tokenResponse);
      set(meta);

      return true;
    },

    signOut: async () => {
      const tokenResponse = await readTokenResponse();
      if (tokenResponse?.accessToken) {
        const revokeTokenRequest = new RevokeTokenRequest({
          clientId,
          token: tokenResponse.accessToken,
        });
        await revokeTokenRequest.performAsync({ revocationEndpoint });
      }
      await storage.clear();
      set(emptySession);
    },

    getAccessToken: async (options) => {
      const forceRefresh = options?.forceRefresh ?? false;
      try {
        let tokenResponse = await readTokenResponse();

        if (!tokenResponse) {
          await storage.clear();
          set(emptySession);
          return null;
        }

        if (forceRefresh || tokenResponse.shouldRefresh()) {
          const refreshTokenRequest = new RefreshTokenRequest({
            refreshToken: tokenResponse.refreshToken,
            clientId,
          });

          tokenResponse = await refreshTokenRequest.performAsync({
            tokenEndpoint,
          });

          const meta = await storeTokenResponse(tokenResponse);
          set(meta);
        }

        return tokenResponse.accessToken;
      } catch (error) {
        if (devMode) console.error(error);
        await storage.clear();
        set(emptySession);
        return null;
      }
    },
  }));

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
