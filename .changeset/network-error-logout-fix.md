---
"authkit-react-native": patch
---

Fix random logouts on unstable network connections. Token refresh failures now only clear the session when the server rejects the refresh token (`TokenError`, e.g. `invalid_grant`); transient failures such as network errors keep the session intact so a later call can retry, and return the stored access token when it is still fresh. Concurrent `getAccessToken()` calls now share a single in-flight refresh, preventing parallel refreshes from racing on the single-use refresh token and signing the user out. `signOut()` now always clears the local session even if the revocation request fails offline.
