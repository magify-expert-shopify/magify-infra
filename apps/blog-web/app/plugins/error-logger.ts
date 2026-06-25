import type { NuxtApp } from "#app";

type NuxtErrorLike = {
  message?: string;
  stack?: string;
  statusCode?: number;
  statusMessage?: string;
  fatal?: boolean;
  url?: string;
};

const loggedErrors = new WeakSet<object>();

function toErrorLike(value: unknown): NuxtErrorLike | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as NuxtErrorLike;
}

function shouldLogError(error: NuxtErrorLike) {
  if (typeof error.statusCode === "number") {
    return error.statusCode >= 500;
  }

  return Boolean(error.fatal);
}

function getRequestUrl(nuxtApp: NuxtApp) {
  if (import.meta.client) {
    return window.location.href;
  }

  return nuxtApp.ssrContext?.event.node.req.url ?? "";
}

function logNuxtError(
  nuxtApp: NuxtApp,
  source: string,
  error: unknown,
) {
  const nuxtError = toErrorLike(error);

  if (!nuxtError) {
    return;
  }

  if (!shouldLogError(nuxtError)) {
    return;
  }

  if (loggedErrors.has(nuxtError)) {
    return;
  }

  loggedErrors.add(nuxtError);

  const payload = {
    source,
    url: nuxtError.url || getRequestUrl(nuxtApp),
    statusCode: nuxtError.statusCode ?? 500,
    statusMessage: nuxtError.statusMessage ?? null,
    message: nuxtError.message ?? "Unknown Nuxt error",
    stack: nuxtError.stack ?? null,
  };

  console.error("[blog-web][nuxt:error]", payload);
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:error", (error) => {
    logNuxtError(nuxtApp, "app:error", error);
  });

  nuxtApp.hook("vue:error", (error) => {
    logNuxtError(nuxtApp, "vue:error", error);
  });
});
