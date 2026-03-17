type ClientIdOrAuthorizationEndpoint =
  | { clientId?: string; authorizationEndpoint: string }
  | { clientId: string; authorizationEndpoint?: string };

export type AuthConfig = ClientIdOrAuthorizationEndpoint & {
  tokenEndpoint: string;
  revocationEndpoint: string;
  redirectUri?: string;
  storageKeyPrefix?: string;
  devMode?: boolean;
};

export type User = {
  id: string;
  email: string;
  emailVerified: boolean;
  profilePictureUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  lastSignInAt: string | null;
  locale: string | null;
  createdAt: string;
  updatedAt: string;
  externalId: string | null;
  metadata: Record<string, string>;
};

export type Impersonator = {
  email: string;
  reason: string | null;
};

export type AuthenticationMethod =
  | "SSO"
  | "Password"
  | "Passkey"
  | "AppleOAuth"
  | "BitbucketOAuth"
  | "GitHubOAuth"
  | "GitLabOAuth"
  | "GoogleOAuth"
  | "LinkedInOAuth"
  | "MicrosoftOAuth"
  | "SalesforceOAuth"
  | "VercelOAuth"
  | "MagicAuth"
  | "CrossAppAuth"
  | "Impersonation";

export type AuthSessionInfo = {
  user: User;
  organizationId?: string;
  impersonator?: Impersonator;
  authenticationMethod?: AuthenticationMethod;
};

export type AuthState = {
  isLoading: boolean;
} & Partial<AuthSessionInfo> & {
    signIn: (options?: {
      screenHint?: "sign-up" | "sign-in";
    }) => Promise<boolean>;
    signOut: () => Promise<void>;
    getAccessToken: (options?: {
      forceRefresh?: boolean;
    }) => Promise<string | null>;
  };
