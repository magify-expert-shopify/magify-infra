import type {
  SupabaseAuthSession,
  SupabaseAuthUser,
} from "~/types/supabase-auth";
import {
  EXPIRY_SAFETY_WINDOW_MS,
  SUPABASE_SESSION_COOKIE,
} from "~/constants/supabase-auth";

type SupabaseSignInResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: {
    id?: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    aud?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_sign_in_at?: string | null;
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
    identities?: Array<Record<string, unknown>> | null;
  };
};

const refreshSessionPromises = new Map<
  string,
  Promise<SupabaseAuthSession | null>
>();
const verifySessionPromises = new Map<
  string,
  Promise<SupabaseAuthUser | null>
>();
const verifiedSessionCache = new Map<
  string,
  { user: SupabaseAuthUser; verifiedAt: number }
>();
const VERIFY_SESSION_CACHE_TTL_MS = 60_000;
type SupabaseSessionVerificationState = {
  accessToken: string;
  verifiedAt: number;
  user: SupabaseAuthUser | null;
};
const SESSION_VERIFICATION_STATE_KEY = "supabase-auth:verification-state";

function mapUser(
  user?: SupabaseSignInResponse["user"] | null,
): SupabaseAuthUser | null {
  if (!user?.id?.trim()) {
    return null;
  }

  return {
    id: user.id.trim(),
    email: user.email?.trim() ?? null,
    phone: user.phone?.trim() ?? null,
    role: user.role?.trim() ?? null,
    aud: user.aud?.trim() ?? null,
    createdAt: user.created_at?.trim() ?? null,
    lastSignInAt: user.last_sign_in_at?.trim() ?? null,
    appMetadata: user.app_metadata ?? {},
    userMetadata: user.user_metadata ?? {},
    identities: (user.identities ?? []).map((identity) => ({
      provider: identity.provider?.trim() ?? null,
    })) as SupabaseAuthSession["user"]["identities"],
  };
}

function createSupabaseRequestHeaders(anonKey: string) {
  if (!anonKey.trim()) {
    throw new Error(
      "La clé Supabase anon est manquante. Vérifie NUXT_SUPABASE_ANON_KEY puis redémarre Nuxt.\n AnonKey = ${anonKey}",
    );
  }

  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export function useSupabaseAuth() {
  const config = useRuntimeConfig();
  const sessionCookie = useCookie<SupabaseAuthSession | null>(
    SUPABASE_SESSION_COOKIE,
    {
      sameSite: "lax",
      path: "/",
      default: () => null,
    },
  );
  const sessionVerificationState =
    useState<SupabaseSessionVerificationState | null>(
      SESSION_VERIFICATION_STATE_KEY,
      () => null,
    );

  const session = computed(() => sessionCookie.value);
  const user = computed(() => session.value?.user ?? null);
  const accessToken = computed(() => session.value?.accessToken ?? null);
  const isAuthenticated = computed(() => Boolean(accessToken.value));

  function setSession(nextSession: SupabaseAuthSession | null) {
    sessionCookie.value = nextSession;
  }

  function clearSession() {
    sessionCookie.value = null;
  }

  function clearSessionVerificationState() {
    sessionVerificationState.value = null;
  }

  function setSessionVerificationState(
    accessToken: string,
    user: SupabaseAuthUser | null,
    verifiedAt = Date.now(),
  ) {
    sessionVerificationState.value = {
      accessToken,
      verifiedAt,
      user,
    };
  }

  function getCachedVerifiedUser(accessTokenValue: string) {
    const currentVerificationState = sessionVerificationState.value;

    if (
      currentVerificationState?.accessToken === accessTokenValue &&
      Date.now() - currentVerificationState.verifiedAt <
        VERIFY_SESSION_CACHE_TTL_MS
    ) {
      return currentVerificationState.user;
    }

    const cachedVerification = verifiedSessionCache.get(accessTokenValue);

    if (
      cachedVerification &&
      Date.now() - cachedVerification.verifiedAt < VERIFY_SESSION_CACHE_TTL_MS
    ) {
      setSessionVerificationState(
        accessTokenValue,
        cachedVerification.user,
        cachedVerification.verifiedAt,
      );

      return cachedVerification.user;
    }

    return undefined;
  }

  function getSupabaseBaseUrl() {
    return String(config.public.supabaseUrl ?? "").replace(/\/+$/, "");
  }

  function getSupabaseAnonKey() {
    console.log("DEBUG CONFIG", {
      public: config.public,
      anonKey: config.public.supabaseAnonKey,
      hasAnonKey: !!config.public.supabaseAnonKey,
    });
    return String(config.public.supabaseAnonKey ?? "").trim();
  }

  async function signInWithPassword(email: string, password: string) {
    const supabaseBaseUrl = getSupabaseBaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    const response = await $fetch<SupabaseSignInResponse>(
      `${supabaseBaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: createSupabaseRequestHeaders(supabaseAnonKey),
        query: {
          apikey: supabaseAnonKey,
        },
        body: {
          email,
          password,
        },
      },
    );

    const mappedUser = mapUser(response.user);
    const accessTokenValue = response.access_token?.trim() ?? "";
    const refreshTokenValue = response.refresh_token?.trim() ?? "";

    if (!accessTokenValue || !refreshTokenValue || !mappedUser) {
      throw new Error("Impossible de créer la session Supabase.");
    }

    const nextSession: SupabaseAuthSession = {
      accessToken: accessTokenValue,
      refreshToken: refreshTokenValue,
      expiresAt: Date.now() + Number(response.expires_in ?? 0) * 1000,
      tokenType: response.token_type?.trim() ?? null,
      user: mappedUser,
    };

    setSession(nextSession);
    setSessionVerificationState(accessTokenValue, mappedUser);
    return nextSession;
  }

  async function refreshSession() {
    const currentRefreshToken = session.value?.refreshToken?.trim() ?? "";

    if (!currentRefreshToken) {
      clearSession();
      return null;
    }

    const existingRefreshPromise =
      refreshSessionPromises.get(currentRefreshToken);
    if (existingRefreshPromise) {
      return existingRefreshPromise;
    }

    const supabaseBaseUrl = getSupabaseBaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    const refreshPromise = (async () => {
      const response = await $fetch<SupabaseSignInResponse>(
        `${supabaseBaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: createSupabaseRequestHeaders(supabaseAnonKey),
          query: {
            apikey: supabaseAnonKey,
          },
          body: {
            refresh_token: currentRefreshToken,
          },
        },
      );

      const mappedUser = mapUser(response.user) ?? session.value?.user ?? null;
      const accessTokenValue = response.access_token?.trim() ?? "";
      const refreshTokenValue =
        response.refresh_token?.trim() || currentRefreshToken;

      if (!accessTokenValue || !mappedUser) {
        clearSession();
        return null;
      }

      const nextSession: SupabaseAuthSession = {
        accessToken: accessTokenValue,
        refreshToken: refreshTokenValue,
        expiresAt: Date.now() + Number(response.expires_in ?? 0) * 1000,
        tokenType:
          response.token_type?.trim() ?? session.value?.tokenType ?? null,
        user: mappedUser,
      };

      setSession(nextSession);
      setSessionVerificationState(accessTokenValue, mappedUser);
      return nextSession;
    })().finally(() => {
      refreshSessionPromises.delete(currentRefreshToken);
    });

    refreshSessionPromises.set(currentRefreshToken, refreshPromise);
    return refreshPromise;
  }

  async function verifySession() {
    if (!accessToken.value) {
      return null;
    }

    const currentAccessToken = accessToken.value.trim();
    const cachedVerification = getCachedVerifiedUser(currentAccessToken);

    if (cachedVerification !== undefined) {
      return cachedVerification;
    }

    const existingVerifyPromise = verifySessionPromises.get(currentAccessToken);
    if (existingVerifyPromise) {
      return existingVerifyPromise;
    }

    try {
      const verifyPromise = (async () => {
        const apiBaseUrl = String(
          config.public.apiUrl || "http://localhost:4000",
        ).replace(/\/+$/, "");
        const response = await $fetch<{ user: SupabaseAuthUser | null }>(
          `${apiBaseUrl}/supabase-auth/me`,
          {
            headers: {
              Authorization: `Bearer ${currentAccessToken}`,
            },
          },
        );

        if (!response.user) {
          setSessionVerificationState(currentAccessToken, null);
          return null;
        }

        setSessionVerificationState(currentAccessToken, response.user);
        verifiedSessionCache.set(currentAccessToken, {
          user: response.user,
          verifiedAt: Date.now(),
        });

        if (session.value) {
          setSession({
            ...session.value,
            user: response.user,
          });
        }

        return response.user;
      })().finally(() => {
        verifySessionPromises.delete(currentAccessToken);
      });

      verifySessionPromises.set(currentAccessToken, verifyPromise);
      return await verifyPromise;
    } catch (error) {
      const currentError = error as {
        statusCode?: number;
        status?: number;
        response?: { status?: number };
      };
      const statusCode =
        currentError.statusCode ??
        currentError.status ??
        currentError.response?.status;

      if (statusCode === 401 || statusCode === 403) {
        setSessionVerificationState(currentAccessToken, null);
      }

      return null;
    }
  }

  async function ensureSession() {
    if (!session.value) {
      clearSessionVerificationState();
      return null;
    }

    const shouldRefresh =
      session.value.expiresAt &&
      Date.now() >= session.value.expiresAt - EXPIRY_SAFETY_WINDOW_MS;

    if (shouldRefresh) {
      const refreshedSession = await refreshSession();
      if (!refreshedSession) {
        clearSession();
        clearSessionVerificationState();
        return null;
      }

      const verifiedAfterRefresh = await verifySession();
      if (!verifiedAfterRefresh) {
        clearSession();
        clearSessionVerificationState();
        return null;
      }
    } else {
      const verifiedUser = await verifySession();
      if (!verifiedUser) {
        clearSession();
        clearSessionVerificationState();
        return null;
      }
    }

    return session.value;
  }

  async function signOut() {
    const restoreAttempts = useState<Record<string, boolean>>(
      "current-project:restore-attempts",
      () => ({}),
    );

    restoreAttempts.value = {};
    useCurrentProject().clearCurrentProject();
    verifiedSessionCache.clear();
    verifySessionPromises.clear();
    clearSessionVerificationState();
    clearSession();
  }

  return {
    session,
    user,
    accessToken,
    isAuthenticated,
    setSession,
    clearSession,
    signInWithPassword,
    refreshSession,
    verifySession,
    ensureSession,
    signOut,
  };
}
