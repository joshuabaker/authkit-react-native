# Expo Client Example

Minimal [Expo](https://expo.dev) app using `authkit-react-native` for authentication.

## Setup

```bash
npx expo install authkit-react-native zustand expo-auth-session expo-secure-store expo-web-browser @react-native-async-storage/async-storage
```

Set your API URL in `.env`:

```
EXPO_PUBLIC_API_URL=https://your-api.example.com
```

## Files

- `hooks/useAuth.ts` — Auth store hook (import everywhere)
- `app/_layout.tsx` — Root layout with `Stack.Protected` auth gate
- `app/sign-in.tsx` — Sign-in screen
- `app/private.tsx` — Authenticated screen

## How it works

The auth store is created at module scope so session restoration starts immediately on app launch. No provider needed — just call `useAuth()` in any component.
