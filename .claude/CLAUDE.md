# AuthKit for React Native

## What this package does

Client-only OAuth 2.0 PKCE library for React Native apps authenticating via WorkOS AuthKit. Handles the full auth lifecycle: sign-in (via in-app browser), token storage, automatic session restoration on app launch, token refresh, and sign-out with revocation.

The package does **not** include server-side code. Server implementations (Hono, Next.js) live in `examples/` as standalone, copy-paste-ready projects.

## How it works

### Store architecture

The core export is `createAuthStore(config)`, which returns a Zustand `StoreApi<AuthState>`. The store is designed to be created at **module scope** (not inside a component), so session restoration begins immediately on import — before React mounts.

```
createAuthStore() → Zustand store (module-level singleton)
  ├── signIn()         — opens AuthKit via expo-auth-session, exchanges code for tokens
  ├── signOut()        — revokes token, clears storage
  ├── getAccessToken() — returns cached token or refreshes if expired
  └── auto-restore     — IIFE that reads stored session on creation
```

Consumers create a `useAuth()` hook that wraps `useStore(authStore)`. There is no React provider.

### Storage strategy

Two storage backends, chosen for their tradeoffs:

- **SecureStore** (Keychain/Keystore) — stores the full token response (access token, refresh token, expiry). Encrypted at rest but slower to read.
- **AsyncStorage** — stores user metadata (user object, org ID, impersonator, auth method). Faster to read, used for instant UI hydration on cold start before the token refresh completes.

Both are keyed with a configurable prefix (default: `workos`).

### Auth flow

1. `signIn()` → `expo-auth-session` opens an in-app browser to the authorization endpoint
2. User authenticates → redirect back with authorization code
3. Code is exchanged for tokens via the `tokenEndpoint` (your server proxy)
4. Tokens stored in SecureStore, user metadata in AsyncStorage, Zustand state updated
5. On next app launch, the auto-restore IIFE reads metadata for instant UI, then calls `getAccessToken({ forceRefresh: true })` to validate/refresh the session

### Configuration modes

Two ways to configure the authorization endpoint:

- **Custom proxy** (recommended): provide `authorizationEndpoint` pointing to your server. The server handles the WorkOS API key.
- **Direct WorkOS**: provide `clientId` and the package uses `https://api.workos.com/user_management/authorize` directly.

At least one of `authorizationEndpoint` or `clientId` must be provided.

## Source files

| File             | Purpose                                                 |
| ---------------- | ------------------------------------------------------- |
| `src/index.ts`   | Public API — re-exports `createAuthStore` and all types |
| `src/store.ts`   | Core Zustand store factory with auth lifecycle logic    |
| `src/storage.ts` | SecureStore + AsyncStorage abstraction                  |
| `src/types.ts`   | All type definitions (inlined from `@workos-inc/node`)  |

## Types

Types for `User`, `Impersonator`, and `AuthenticationMethod` are inlined rather than imported from `@workos-inc/node`. This keeps the package dependency-free (no Node.js server SDK in a React Native app). The types mirror the WorkOS API response shape.

## Examples

| Directory          | What it shows                                                      |
| ------------------ | ------------------------------------------------------------------ |
| `examples/expo/`   | Minimal Expo client app with `useAuth` hook and `Stack.Protected`  |
| `examples/hono/`   | Standalone Hono server (Cloudflare Workers) with auth proxy routes |
| `examples/nextjs/` | Next.js App Router with auth proxy route handlers                  |

Examples are self-contained with their own `package.json`. They duplicate server logic intentionally — they're meant to be copied into consumer projects.

**When changing `src/` code, review examples for needed updates.** In particular:

- Changes to `AuthState`, `AuthConfig`, or `AuthSessionInfo` types may require updating the Expo example's `useAuth` hook and components.
- Changes to the token response format or Zod schemas require updating both the Hono and Next.js server examples.
- New exports from `src/index.ts` should be reflected in the Expo example if they affect consumer usage.

## Key design decisions

- **No React provider**: Zustand store lives outside React, so there's no context provider to wrap the app in. This also means session restoration starts before the first render.
- **Module-level side effects**: `WebBrowser.maybeCompleteAuthSession()` runs at import time (required by expo-auth-session to complete the OAuth redirect). `WebBrowser.warmUpAsync()` runs at store creation for faster sign-in.
- **Peer dependencies only**: All Expo modules and Zustand are peer deps. The package has zero direct dependencies.
- **`emptySession` constant**: Used in `signOut`, `getAccessToken` (no-token path), and `getAccessToken` (error path) to clear auth state consistently.

## Build

The package is built with tsup (ESM + declaration files). Entry point is `src/index.ts`, output goes to `dist/`.

```bash
pnpm build        # Build with tsup (ESM + .d.ts to dist/)
pnpm type-check   # Type-check the package
```

`prepublishOnly` runs the build automatically before `npm publish`.

## Publishing

- Published as ESM (`"type": "module"`) with TypeScript declarations
- `"files"` in package.json limits the tarball to `dist/`, `README.md`, `LICENSE`
- Use `npm pack --dry-run` to verify package contents before publishing
- `sideEffects` is intentionally omitted — `store.ts` runs `WebBrowser.maybeCompleteAuthSession()` at module level, which bundlers must not tree-shake away

## Package configuration

- **Peer deps use wide ranges** (`>=5`, `>=13`, etc.) for broad ecosystem compatibility — not pinned to monorepo versions
- **Zero direct dependencies** — all runtime deps are peer deps
- **tsup externalizes all peer deps** via `tsup.config.ts`
