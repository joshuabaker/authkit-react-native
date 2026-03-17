import { type AuthenticationResponse, WorkOS } from "@workos-inc/node";
import { decodeJwt } from "jose";
import { z } from "zod";

// ---------------------------------------------------------------------------
// WorkOS client
// ---------------------------------------------------------------------------

export const workos = new WorkOS(process.env.WORKOS_API_KEY!);
export const clientId = process.env.WORKOS_CLIENT_ID!;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const authorizeSchema = z.object({
  redirect_uri: z.string(),
  code_challenge: z.string(),
  code_challenge_method: z.enum(["S256"]),
  state: z.string().optional(),
  screen_hint: z.enum(["sign-up", "sign-in"]).optional(),
});

export const tokenSchema = z.discriminatedUnion("grant_type", [
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

export const revokeSchema = z.object({
  token: z.string(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export function getAuthorizationUrl(
  params: z.infer<typeof authorizeSchema>,
): string {
  return workos.userManagement.getAuthorizationUrl({
    clientId,
    provider: "authkit",
    codeChallenge: params.code_challenge,
    codeChallengeMethod: params.code_challenge_method,
    redirectUri: params.redirect_uri,
    state: params.state,
    screenHint: params.screen_hint,
  });
}

export async function exchangeToken(
  params: z.infer<typeof tokenSchema> & {
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<TokenResponse> {
  let authenticationResponse: AuthenticationResponse;

  if (params.grant_type === "authorization_code") {
    authenticationResponse = await workos.userManagement.authenticateWithCode({
      clientId,
      code: params.code,
      codeVerifier: params.code_verifier,
    });
  } else {
    authenticationResponse =
      await workos.userManagement.authenticateWithRefreshToken({
        clientId,
        refreshToken: params.refresh_token,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
  }

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

export async function revokeSession(
  params: z.infer<typeof revokeSchema>,
): Promise<{ success: true }> {
  const decodedToken = decodeJwt<{ sid: string }>(params.token);

  await workos.userManagement.revokeSession({
    sessionId: decodedToken.sid,
  });

  return { success: true };
}
