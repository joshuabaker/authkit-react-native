# Next.js Auth Server Example

Auth proxy endpoints for [Next.js](https://nextjs.org) App Router with WorkOS AuthKit.

## Setup

```bash
npm install @workos-inc/node jose zod
```

Set environment variables in `.env.local`:

```
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
```

## Endpoints

Copy the `app/api/auth/` directory into your Next.js project:

| Route                 | Method | Description                                        |
| --------------------- | ------ | -------------------------------------------------- |
| `/api/auth/authorize` | GET    | Redirects to WorkOS AuthKit sign-in                |
| `/api/auth/token`     | POST   | Exchanges authorization codes and refreshes tokens |
| `/api/auth/revoke`    | POST   | Revokes a session                                  |

## Client Configuration

Point `authkit-react-native` at your server:

```typescript
const authStore = createAuthStore({
  authorizationEndpoint: "https://your-app.example.com/api/auth/authorize",
  tokenEndpoint: "https://your-app.example.com/api/auth/token",
  revocationEndpoint: "https://your-app.example.com/api/auth/revoke",
});
```
