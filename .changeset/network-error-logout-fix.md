---
"authkit-react-native": patch
---

Fix random logouts on unstable network connections. Token refresh failures now only clear the session when the server rejects the refresh token (`TokenError`, e.g. `invalid_grant`); transient failures such as network errors keep the session intact so a later call can retry, and return the stored access token when it is still fresh. `signOut()` now always clears the local session even if the revocation request fails offline.
