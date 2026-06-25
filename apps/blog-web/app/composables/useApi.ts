import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  LONGER_TIMEOUT_ERROR_PATTERNS,
  PROJECT_SCOPED_PREFIXES,
  RETRY_REQUEST_TIMEOUT_MS,
} from "~/constants/api";

export function useApi() {
  const config = useRuntimeConfig();
  const { accessToken } = useSupabaseAuth();
  const { currentProject } = useCurrentProject();
  const apiBaseUrl = computed(() =>
    String(
      import.meta.server
        ? config.apiInternalUrl || config.public.apiUrl
        : config.public.apiUrl || "http://localhost:4000",
    ).replace(/\/+$/, ""),
  );

  function isProjectScopedRequest(url: string) {
    return PROJECT_SCOPED_PREFIXES.some(
      (prefix) => url === prefix || url.startsWith(`${prefix}/`),
    );
  }

  function resolveRequestTimeout(options?: Parameters<typeof $fetch>[1]) {
    const timeout =
      typeof options?.timeout === "number" && options.timeout > 0
        ? options.timeout
        : DEFAULT_REQUEST_TIMEOUT_MS;

    return timeout;
  }

  function shouldRetryWithLongerTimeout(error: unknown) {
    if (!error || typeof error !== "object") {
      return false;
    }

    const fetchError = error as {
      name?: string;
      message?: string;
      status?: number;
      statusCode?: number;
      response?: unknown;
      cause?: { code?: string; message?: string } | null;
      data?: unknown;
    };

    if (fetchError.response || fetchError.status || fetchError.statusCode) {
      return false;
    }

    const errorText = [
      fetchError.name,
      fetchError.message,
      fetchError.cause?.code,
      fetchError.cause?.message,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    return LONGER_TIMEOUT_ERROR_PATTERNS.some((pattern) =>
      errorText.includes(pattern),
    );
  }

  function request<T>(url: string, options?: Parameters<typeof $fetch<T>>[1]) {
    const { onRequest, headers, query, ...restOptions } = options ?? {};
    const nextQuery = query ? { ...(query as Record<string, unknown>) } : {};

    if (isProjectScopedRequest(url) && !("projectId" in nextQuery)) {
      const projectId = currentProject.value?.id?.trim();

      if (!projectId) {
        throw new Error("Un projet courant est requis pour cette requête API.");
      }

      nextQuery.projectId = projectId;
    }

    const baseTimeout = resolveRequestTimeout(options);

    const runRequest = (timeout: number) =>
      $fetch<T>(url, {
        baseURL: apiBaseUrl.value,
        query: nextQuery,
        timeout,
        onRequest(context) {
          const requestHeaders = new Headers(headers ?? undefined);

          if (accessToken.value) {
            requestHeaders.set("Authorization", `Bearer ${accessToken.value}`);
          }

          context.options.headers = requestHeaders;
          onRequest?.(context);
        },
        ...restOptions,
      });

    return runRequest(baseTimeout).catch((error) => {
      if (!shouldRetryWithLongerTimeout(error)) {
        throw error;
      }

      return runRequest(Math.max(RETRY_REQUEST_TIMEOUT_MS, baseTimeout * 2));
    });
  }

  return {
    request,
  };
}
