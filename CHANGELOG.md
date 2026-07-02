# authkit-react-native

## 0.1.3

### Patch Changes

- [#43](https://github.com/joshuabaker/authkit-react-native/pull/43) [`469d67d`](https://github.com/joshuabaker/authkit-react-native/commit/469d67d3e2ece341cb033f204b48a24cba4970e2) Thanks [@joshuabaker](https://github.com/joshuabaker)! - Fix random logouts on unstable network connections. Token refresh failures now only clear the session when the server rejects the refresh token (`TokenError`, e.g. `invalid_grant`); transient failures such as network errors keep the session intact so a later call can retry, and return the stored access token when it is still fresh. Concurrent `getAccessToken()` calls now share a single in-flight refresh, preventing parallel refreshes from racing on the single-use refresh token and signing the user out. `signOut()` now always clears the local session even if the revocation request fails offline.

## 0.1.2

### Patch Changes

- [#38](https://github.com/joshuabaker/authkit-react-native/pull/38) [`b802d8e`](https://github.com/joshuabaker/authkit-react-native/commit/b802d8e20395dfbc7206b6b31e423af92c00b686) Thanks [@joshuabaker](https://github.com/joshuabaker)! - Publish to npm via OIDC trusted publishing (tokenless). No runtime or API changes.

## 0.1.1

### Patch Changes

- [#36](https://github.com/joshuabaker/authkit-react-native/pull/36) [`1a8d5d4`](https://github.com/joshuabaker/authkit-react-native/commit/1a8d5d4c5db051da3376f11525f9ace6a8919d82) Thanks [@joshuabaker](https://github.com/joshuabaker)! - Migrate npm publishing to OIDC trusted publishing. No runtime or API changes.

## 0.1.0

### Minor Changes

- [#4](https://github.com/joshuabaker/authkit-react-native/pull/4) [`7544eed`](https://github.com/joshuabaker/authkit-react-native/commit/7544eeda3c4db69a2ef65fbb82d71a69ccb9eb9f) Thanks [@joshuabaker](https://github.com/joshuabaker)! - Initial release — OAuth 2.0 PKCE auth store for React Native with WorkOS AuthKit
