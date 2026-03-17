import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "zustand";

import type { AuthState } from "../src/types";
import {
  __defaults as authMocks,
  __lastInstance,
  AuthRequest,
} from "./mocks/expo-auth-session";
import * as WebBrowser from "./mocks/expo-web-browser";
import * as SecureStore from "./mocks/expo-secure-store";
import AsyncStorage from "./mocks/async-storage";

const fakeUser = {
  id: "user_01",
  email: "test@example.com",
  emailVerified: true,
  profilePictureUrl: null,
  firstName: "Test",
  lastName: "User",
  lastSignInAt: null,
  locale: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  externalId: null,
  metadata: {},
};

function fakeTokenResult(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    rawResponse: { user: fakeUser, organizationId: "org_01" },
    getRequestConfig() {
      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        rawResponse: this.rawResponse,
      };
    },
    shouldRefresh: () => false,
    ...overrides,
  };
}

const baseConfig = {
  clientId: "client_123",
  tokenEndpoint: "https://example.com/token",
  revocationEndpoint: "https://example.com/revoke",
};

function resetAllMocks() {
  vi.clearAllMocks();
  SecureStore.__clear();
  AsyncStorage.__clear();
  // Reset default mock behaviors
  authMocks.promptAsync.mockReset();
  authMocks.accessTokenPerformAsync.mockReset();
  authMocks.refreshTokenPerformAsync.mockReset();
  authMocks.revokeTokenPerformAsync.mockReset();
  authMocks.shouldRefresh.mockReset().mockReturnValue(false);
  authMocks.codeVerifier = "test-code-verifier";
}

/** Create store and wait for auto-restore to finish */
async function createStoreAndWait(
  configOverrides: Record<string, unknown> = {},
) {
  const { createAuthStore } = await import("../src/store");
  const store = createAuthStore({ ...baseConfig, ...configOverrides } as any);
  await vi.waitFor(() => {
    if (store.getState().isLoading) throw new Error("still loading");
  });
  return store;
}

/** Seed SecureStore with a valid token JSON */
async function seedTokens(overrides: Record<string, unknown> = {}) {
  await SecureStore.setItemAsync(
    "workos.tokens",
    JSON.stringify({
      accessToken: "stored-access",
      refreshToken: "stored-refresh",
      rawResponse: { user: fakeUser, organizationId: "org_01" },
      ...overrides,
    }),
  );
}

describe("config validation", () => {
  beforeEach(resetAllMocks);
  afterEach(() => vi.resetModules());

  it("throws when using default endpoint without clientId", async () => {
    const { createAuthStore } = await import("../src/store");
    expect(() =>
      createAuthStore({
        tokenEndpoint: "https://example.com/token",
        revocationEndpoint: "https://example.com/revoke",
      } as any),
    ).toThrow("clientId is required");
  });

  it("allows custom authorizationEndpoint without clientId", async () => {
    const store = await createStoreAndWait({
      clientId: undefined,
      authorizationEndpoint: "https://custom.example.com/auth",
    });
    expect(store.getState()).toBeDefined();
  });

  it("allows default endpoint with clientId", async () => {
    const store = await createStoreAndWait();
    expect(store.getState()).toBeDefined();
  });
});

describe("initialization", () => {
  beforeEach(resetAllMocks);
  afterEach(() => vi.resetModules());

  it("starts with isLoading: true", async () => {
    const { createAuthStore } = await import("../src/store");
    const store = createAuthStore({ ...baseConfig } as any);
    expect(store.getState().isLoading).toBe(true);
    await vi.waitFor(() => {
      if (store.getState().isLoading) throw new Error("still loading");
    });
  });

  it("calls WebBrowser.warmUpAsync on creation", async () => {
    await createStoreAndWait();
    expect(WebBrowser.warmUpAsync).toHaveBeenCalled();
  });

  it("calls WebBrowser.maybeCompleteAuthSession on module import", async () => {
    await import("../src/store");
    expect(WebBrowser.maybeCompleteAuthSession).toHaveBeenCalled();
  });
});

describe("signIn", () => {
  let store: StoreApi<AuthState>;

  beforeEach(async () => {
    resetAllMocks();
    vi.resetModules();

    // Default: success flow
    authMocks.promptAsync.mockResolvedValue({
      type: "success",
      params: { state: "test-state", code: "auth-code" },
    });
    authMocks.accessTokenPerformAsync.mockResolvedValue(fakeTokenResult());

    store = await createStoreAndWait();
  });

  afterEach(() => vi.resetModules());

  it("success flow — exchanges code for tokens, updates state, returns true", async () => {
    const result = await store.getState().signIn();
    expect(result).toBe(true);
    expect(store.getState().user).toEqual(fakeUser);
    expect(store.getState().organizationId).toBe("org_01");
    expect(SecureStore.setItemAsync).toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("returns false on cancellation", async () => {
    authMocks.promptAsync.mockResolvedValue({ type: "cancel" });
    const result = await store.getState().signIn();
    expect(result).toBe(false);
  });

  it("throws error with description", async () => {
    authMocks.promptAsync.mockResolvedValue({
      type: "error",
      error: { description: "Access denied" },
    });
    await expect(store.getState().signIn()).rejects.toThrow("Access denied");
  });

  it("throws 'Unknown error' without description", async () => {
    authMocks.promptAsync.mockResolvedValue({
      type: "error",
      error: {},
    });
    await expect(store.getState().signIn()).rejects.toThrow("Unknown error");
  });

  it("throws on state mismatch", async () => {
    authMocks.promptAsync.mockResolvedValue({
      type: "success",
      params: { state: "wrong-state", code: "auth-code" },
    });
    await expect(store.getState().signIn()).rejects.toThrow("State mismatch");
  });

  it("throws when code verifier is missing", async () => {
    authMocks.promptAsync.mockResolvedValue({
      type: "success",
      params: { state: "test-state", code: "auth-code" },
    });
    authMocks.codeVerifier = "";

    await expect(store.getState().signIn()).rejects.toThrow(
      "Code verifier missing",
    );

    authMocks.codeVerifier = "test-code-verifier";
  });

  it("defaults screenHint to 'sign-in'", async () => {
    await store.getState().signIn();
    // AuthRequest is called with `new` — check the constructor arg
    expect(__lastInstance.authRequest?.config).toMatchObject({
      extraParams: { screen_hint: "sign-in" },
    });
  });

  it("respects screenHint 'sign-up'", async () => {
    await store.getState().signIn({ screenHint: "sign-up" });
    expect(__lastInstance.authRequest?.config).toMatchObject({
      extraParams: { screen_hint: "sign-up" },
    });
  });
});

describe("signOut", () => {
  beforeEach(resetAllMocks);
  afterEach(() => vi.resetModules());

  it("revokes token and clears storage when token exists", async () => {
    authMocks.revokeTokenPerformAsync.mockResolvedValue(undefined);
    // Need a valid refresh response for auto-restore's forceRefresh
    authMocks.refreshTokenPerformAsync.mockResolvedValue(fakeTokenResult());

    await seedTokens();
    await AsyncStorage.setItem(
      "workos.meta",
      JSON.stringify({ user: fakeUser }),
    );

    const store = await createStoreAndWait();

    // Re-seed tokens for signOut to find
    await seedTokens();
    vi.clearAllMocks();

    await store.getState().signOut();

    expect(authMocks.revokeTokenPerformAsync).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
    expect(store.getState().user).toBeUndefined();
  });

  it("skips revocation when no token, still clears storage", async () => {
    const store = await createStoreAndWait();
    vi.clearAllMocks();

    await store.getState().signOut();

    expect(authMocks.revokeTokenPerformAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(store.getState().user).toBeUndefined();
  });
});

describe("getAccessToken", () => {
  beforeEach(resetAllMocks);
  afterEach(() => vi.resetModules());

  it("returns null and clears storage when no stored token", async () => {
    const store = await createStoreAndWait();
    const token = await store.getState().getAccessToken();
    expect(token).toBeNull();
  });

  it("returns cached accessToken when valid and no forceRefresh", async () => {
    // Auto-restore will call getAccessToken({ forceRefresh: true }), so
    // provide a refresh result for that initial call
    authMocks.refreshTokenPerformAsync.mockResolvedValue(
      fakeTokenResult({ accessToken: "cached-token" }),
    );
    await seedTokens({ accessToken: "cached-token" });

    const store = await createStoreAndWait();
    vi.clearAllMocks();
    authMocks.shouldRefresh.mockReturnValue(false);

    // Re-seed tokens (auto-restore wrote refreshed tokens)
    await seedTokens({ accessToken: "cached-token" });

    const token = await store.getState().getAccessToken();
    expect(token).toBe("cached-token");
    expect(authMocks.refreshTokenPerformAsync).not.toHaveBeenCalled();
  });

  it("refreshes when shouldRefresh() returns true", async () => {
    // Let auto-restore complete normally
    authMocks.refreshTokenPerformAsync.mockResolvedValue(fakeTokenResult());
    await seedTokens();

    const store = await createStoreAndWait();
    vi.clearAllMocks();

    // Re-seed and configure for the actual test call
    await seedTokens({ accessToken: "old-token" });
    authMocks.shouldRefresh.mockReturnValue(true);
    authMocks.refreshTokenPerformAsync.mockResolvedValue(
      fakeTokenResult({ accessToken: "refreshed-token" }),
    );

    const token = await store.getState().getAccessToken();
    expect(token).toBe("refreshed-token");
    expect(authMocks.refreshTokenPerformAsync).toHaveBeenCalled();
  });

  it("always refreshes when forceRefresh is true", async () => {
    authMocks.refreshTokenPerformAsync.mockResolvedValue(fakeTokenResult());
    await seedTokens();

    const store = await createStoreAndWait();
    vi.clearAllMocks();

    await seedTokens({ accessToken: "old-token" });
    authMocks.shouldRefresh.mockReturnValue(false);
    authMocks.refreshTokenPerformAsync.mockResolvedValue(
      fakeTokenResult({ accessToken: "force-refreshed" }),
    );

    const token = await store.getState().getAccessToken({ forceRefresh: true });
    expect(token).toBe("force-refreshed");
    expect(authMocks.refreshTokenPerformAsync).toHaveBeenCalled();
  });

  it("catches refresh error, clears storage, returns null", async () => {
    authMocks.refreshTokenPerformAsync.mockResolvedValue(fakeTokenResult());
    await seedTokens();

    const store = await createStoreAndWait();
    vi.clearAllMocks();

    await seedTokens({ accessToken: "old-token" });
    authMocks.shouldRefresh.mockReturnValue(true);
    authMocks.refreshTokenPerformAsync.mockRejectedValue(
      new Error("refresh failed"),
    );

    const token = await store.getState().getAccessToken();
    expect(token).toBeNull();
    expect(store.getState().user).toBeUndefined();
  });

  it("logs error in devMode", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    authMocks.refreshTokenPerformAsync.mockResolvedValue(fakeTokenResult());
    await seedTokens();

    const store = await createStoreAndWait({ devMode: true });
    vi.clearAllMocks();

    await seedTokens({ accessToken: "old-token" });
    authMocks.shouldRefresh.mockReturnValue(true);
    authMocks.refreshTokenPerformAsync.mockRejectedValue(
      new Error("refresh failed"),
    );

    await store.getState().getAccessToken();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("does not log error when devMode is false", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    authMocks.refreshTokenPerformAsync.mockResolvedValue(fakeTokenResult());
    await seedTokens();

    const store = await createStoreAndWait({ devMode: false });
    vi.clearAllMocks();

    await seedTokens({ accessToken: "old-token" });
    authMocks.shouldRefresh.mockReturnValue(true);
    authMocks.refreshTokenPerformAsync.mockRejectedValue(
      new Error("refresh failed"),
    );

    await store.getState().getAccessToken();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("auto-restore", () => {
  beforeEach(resetAllMocks);
  afterEach(() => vi.resetModules());

  it("hydrates state from stored meta, then refreshes", async () => {
    await AsyncStorage.setItem(
      "workos.meta",
      JSON.stringify({ user: fakeUser, organizationId: "org_01" }),
    );
    await seedTokens();

    authMocks.refreshTokenPerformAsync.mockResolvedValue(
      fakeTokenResult({ accessToken: "restored-token" }),
    );

    const store = await createStoreAndWait();
    expect(store.getState().user).toEqual(fakeUser);
    expect(store.getState().isLoading).toBe(false);
  });

  it("skips hydration when no stored meta, still calls getAccessToken", async () => {
    const store = await createStoreAndWait();
    expect(store.getState().user).toBeUndefined();
    expect(store.getState().isLoading).toBe(false);
  });

  it("sets isLoading to false even on error", async () => {
    await AsyncStorage.setItem(
      "workos.meta",
      JSON.stringify({ user: fakeUser }),
    );
    await SecureStore.setItemAsync("workos.tokens", "invalid json{{{");

    const store = await createStoreAndWait();
    expect(store.getState().isLoading).toBe(false);
  });
});
