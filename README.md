# AuthKit for React Native

WorkOS AuthKit integration for React Native, built on Zustand and Expo modules.

- 🔒 Secure token storage (Keychain/Keystore)
- 🔄 Automatic session restoration and token refresh
- 🔏 PKCE for added security
- 🧩 Zustand-based — no nested providers or layouts required

## Installation

```bash
npx expo install authkit-react-native zustand expo-auth-session expo-secure-store expo-web-browser @react-native-async-storage/async-storage
```

## Usage

### Create the hook

Create a `useAuth` hook that your app imports everywhere. The store is created at module scope so the session begins restoring immediately on app launch.

```typescript
// hooks/useAuth.ts
import { createAuthStore } from "authkit-react-native";
import { useStore } from "zustand";

const authStore = createAuthStore({
  // Provide authorizationEndpoint or clientId
  authorizationEndpoint: "https://api.example.com/v1/auth/authorize",
  tokenEndpoint: "https://api.example.com/v1/auth/token",
  revocationEndpoint: "https://api.example.com/v1/auth/revoke",
});

export function useAuth() {
  return useStore(authStore);
}
```

### Protected routes

Use `Stack.Protected` to gate routes based on auth state. Because the store lives outside React, there's no provider to wrap your app in — just call `useAuth()` in your root layout.

> Requires Expo SDK 53+ (Expo Router v5).

```tsx
// app/_layout.tsx
import { useAuth } from "@/hooks/useAuth";
import { Loading } from "@/components/Loading";
import { Stack } from "expo-router";

export default function RootLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;

  return (
    <Stack>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
```

### Sign in

Call `signIn()` to open the WorkOS AuthKit sign-in page. Returns `true` on success, `false` if the user cancelled.

```tsx
import { useAuth } from "@/hooks/useAuth";

function SignInScreen() {
  const { signIn } = useAuth();

  return (
    <>
      <Button title="Sign in" onPress={() => signIn()} />
      <Button
        title="Sign up"
        onPress={() => signIn({ screenHint: "sign-up" })}
      />
    </>
  );
}
```

### Sign out

`signOut()` revokes the token and clears storage. It does not show any confirmation UI — add that in your app:

```tsx
import { useAuth } from "@/hooks/useAuth";
import { Alert } from "react-native";

function SignOutButton() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      `Are you sure you want to sign out as ${user.email}?`,
      undefined,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => signOut() },
      ],
    );
  };

  return <Button title="Sign out" onPress={handleSignOut} />;
}
```

## Configuration

| Option                  | Required | Default             | Description                                                               |
| ----------------------- | -------- | ------------------- | ------------------------------------------------------------------------- |
| `authorizationEndpoint` | \*       | WorkOS default      | OAuth authorize URL. Required unless `clientId` is provided.              |
| `clientId`              | \*       | —                   | WorkOS client ID. Required when using the default authorization endpoint. |
| `tokenEndpoint`         | Yes      | —                   | Token exchange URL.                                                       |
| `revocationEndpoint`    | Yes      | —                   | Token revocation URL.                                                     |
| `redirectUri`           | No       | `makeRedirectUri()` | OAuth redirect URI.                                                       |
| `storageKeyPrefix`      | No       | `"workos"`          | Prefix for SecureStore/AsyncStorage keys.                                 |
| `devMode`               | No       | `false`             | Logs errors to the console when enabled.                                  |

## Examples

See the [`examples/`](examples/) directory for complete, copy-paste-ready projects:

- **[Expo](examples/expo/)** — Minimal client app with `useAuth` hook
- **[Hono](examples/hono/)** — Auth proxy server on Cloudflare Workers
- **[Next.js](examples/nextjs/)** — Auth proxy server with App Router route handlers
