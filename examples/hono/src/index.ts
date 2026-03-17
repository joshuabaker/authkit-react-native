import { type AuthenticationResponse, WorkOS } from "@workos-inc/node";
import { decodeJwt } from "jose";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const authorizeSchema = z.object({
  redirect_uri: z.string(),
  code_challenge: z.string(),
  code_challenge_method: z.enum(["S256"]),
  state: z.string().optional(),
  screen_hint: z.enum(["sign-up", "sign-in"]).optional(),
});

const tokenSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string(),
    code_verifier: z.string(),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string(),
  }),
]);

const revokeSchema = z.object({
  token: z.string(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ServerConfig = {
  workos: WorkOS;
  clientId: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  issued_at?: number;
  user: AuthenticationResponse["user"];
  organizationId?: AuthenticationResponse["organizationId"];
  impersonator?: AuthenticationResponse["impersonator"];
  authenticationMethod?: AuthenticationResponse["authenticationMethod"];
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function getAuthorizationUrl(
  params: z.infer<typeof authorizeSchema>,
  config: ServerConfig,
): string {
  return config.workos.userManagement.getAuthorizationUrl({
    clientId: config.clientId,
    provider: "authkit",
    codeChallenge: params.code_challenge,
    codeChallengeMethod: params.code_challenge_method,
    redirectUri: params.redirect_uri,
    state: params.state,
    screenHint: params.screen_hint,
  });
}

async function exchangeToken(
  params: z.infer<typeof tokenSchema> & {
    ipAddress?: string;
    userAgent?: string;
  },
  config: ServerConfig,
): Promise<TokenResponse> {
  let authenticationResponse: AuthenticationResponse;

  if (params.grant_type === "authorization_code") {
    authenticationResponse =
      await config.workos.userManagement.authenticateWithCode({
        clientId: config.clientId,
        code: params.code,
        codeVerifier: params.code_verifier,
      });
  } else {
    authenticationResponse =
      await config.workos.userManagement.authenticateWithRefreshToken({
        clientId: config.clientId,
        refreshToken: params.refresh_token,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
  }

  return formatTokenResponse(authenticationResponse);
}

async function revokeSession(
  params: z.infer<typeof revokeSchema>,
  config: ServerConfig,
): Promise<{ success: true }> {
  const decodedToken = decodeJwt<{ sid: string }>(params.token);

  await config.workos.userManagement.revokeSession({
    sessionId: decodedToken.sid,
  });

  return { success: true };
}

function formatTokenResponse(
  authenticationResponse: AuthenticationResponse,
): TokenResponse {
  const { accessToken, refreshToken } = authenticationResponse;
  const decodedToken = decodeJwt<{ exp: number }>(accessToken);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: decodedToken.exp - Math.floor(Date.now() / 1000),
    issued_at: decodedToken.iat,
    user: authenticationResponse.user,
    organizationId: authenticationResponse.organizationId,
    impersonator: authenticationResponse.impersonator,
    authenticationMethod: authenticationResponse.authenticationMethod,
  };
}

// ---------------------------------------------------------------------------
// Hono Routes
// ---------------------------------------------------------------------------

// Adapt for your runtime. This example uses Cloudflare Workers bindings.
// For Node.js/Bun/Deno, replace `c.env.*` with `process.env.*`.

type Bindings = {
  WORKOS_API_KEY: string;
  WORKOS_CLIENT_ID: string;
};

export const auth = new Hono<{ Bindings: Bindings }>();

auth.get("/authorize", zValidator("query", authorizeSchema), (c) => {
  const params = c.req.valid("query");
  const url = getAuthorizationUrl(params, {
    workos: new WorkOS(c.env.WORKOS_API_KEY),
    clientId: c.env.WORKOS_CLIENT_ID,
  });
  return c.redirect(url);
});

auth.post("/token", zValidator("form", tokenSchema), async (c) => {
  const params = c.req.valid("form");
  try {
    const response = await exchangeToken(
      {
        ...params,
        ipAddress: c.req.header("X-Forwarded-For")?.split(",")[0]?.trim(),
        userAgent: c.req.header("User-Agent"),
      },
      {
        workos: new WorkOS(c.env.WORKOS_API_KEY),
        clientId: c.env.WORKOS_CLIENT_ID,
      },
    );
    return c.json(response);
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.post("/revoke", zValidator("form", revokeSchema), async (c) => {
  const params = c.req.valid("form");
  try {
    const result = await revokeSession(params, {
      workos: new WorkOS(c.env.WORKOS_API_KEY),
      clientId: c.env.WORKOS_CLIENT_ID,
    });
    return c.json(result);
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});
