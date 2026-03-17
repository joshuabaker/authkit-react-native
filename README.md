# AuthKit for React Native

WorkOS AuthKit integration for React Native. Handles the full OAuth 2.0 PKCE flow, token storage, automatic session restoration, and token refresh — built on Zustand and Expo modules.

For server-side auth proxy examples (Hono, Next.js), see the [`examples/`](examples/) directory.

## Installation

```bash
npx expo install authkit-react-native zustand expo-auth-session expo-secure-store expo-web-browser @react-native-async-storage/async-storage
```

## Client Usage

### Create the hook

Create a `useAuth` hook that your app imports everywhere. The store is created at module scope so the session begins restoring immediately on app launch.

```typescript
// hooks/useAuth.ts
import { createAuthStore } from "authkit-react-native";
import { useStore } from "zustand";

const authStore = createAuthStore({
  authorizationEndpoint: `${process.env.EXPO_PUBLIC_API_URL}/v1/auth/authorize`,
  tokenEndpoint: `${process.env.EXPO_PUBLIC_API_URL}/v1/auth/token`,
  revocationEndpoint: `${process.env.EXPO_PUBLIC_API_URL}/v1/auth/revoke`,
});

export function useAuth() {
  return useStore(authStore);
}
```

### Protected routes

Because the store lives outside React, there's no provider to wrap your app in. Just call `useAuth()` in a layout to gate routes while the session is loading:

```tsx
// app/(auth)/_layout.tsx
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!user) return <Redirect href="/sign-in" />;

  return <Stack />;
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
      user?.email
        ? `Are you sure you want to sign out as ${user.email}?`
        : "Are you sure you want to sign out?",
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

## Bare React Native (without Expo)

This package is built around Expo modules but works in any React Native app. Expo packages can be used in bare React Native projects by adding the Expo modules runtime:

1. Install the `expo` package:
   ```bash
   npm install expo
   npx install-expo-modules
   ```
2. Install the peer dependencies using `npx expo install` (handles native linking):
   ```bash
   npx expo install expo-auth-session expo-secure-store expo-web-browser @react-native-async-storage/async-storage zustand
   ```
3. Ensure your app's URL scheme is configured for the OAuth redirect. In `app.json` or your native project's `Info.plist` / `AndroidManifest.xml`, register a deep link scheme (e.g., `myapp://`).

After that, usage is identical to the examples above.

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
