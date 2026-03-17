# Hono Auth Server Example

A complete auth proxy server using [Hono](https://hono.dev) with WorkOS AuthKit. Works on Cloudflare Workers, Node.js, Bun, and Deno.

## Setup

```bash
npm install hono @hono/zod-validator @workos-inc/node jose zod
```

### Cloudflare Workers

Set secrets via `wrangler secret put`:

```
WORKOS_API_KEY
WORKOS_CLIENT_ID
```

### Node.js / Bun / Deno

Set environment variables:

```
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
```

## Usage

Mount the auth routes at your preferred path:

```typescript
import { Hono } from "hono";
import { auth } from "./src/index";

const app = new Hono();
app.route("/v1/auth", auth);

export default app;
```

The server exposes three endpoints:

| Endpoint     | Method | Description                                        |
| ------------ | ------ | -------------------------------------------------- |
| `/authorize` | GET    | Redirects to WorkOS AuthKit sign-in                |
| `/token`     | POST   | Exchanges authorization codes and refreshes tokens |
| `/revoke`    | POST   | Revokes a session                                  |

## Client Configuration

Point `authkit-react-native` at your server:

```typescript
const authStore = createAuthStore({
  authorizationEndpoint: "https://your-api.example.com/v1/auth/authorize",
  tokenEndpoint: "https://your-api.example.com/v1/auth/token",
  revocationEndpoint: "https://your-api.example.com/v1/auth/revoke",
});
```
