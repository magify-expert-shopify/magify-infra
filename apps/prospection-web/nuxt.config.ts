// https://nuxt.com/docs/api/configuration/nuxt-config
const appUrl =
  process.env.APP_URL?.trim() ||
  `http://localhost:${Number(process.env.PORT || 3000)}`;
const appUrlObject = new URL(appUrl);
const isDevProxyHost = appUrlObject.hostname.endsWith('.dev.magify.local');
const hmrClientPort = isDevProxyHost ? 80 : Number(process.env.PORT || 3000);

console.info(`[prospection-web] available at ${appUrl}`);

export default defineNuxtConfig({
  devServer: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3000),
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: ["@nuxt/ui"],

  ui: {
    theme: {
      colors: [
        "primary",
        "secondary",
        "success",
        "info",
        "warning",
        "error",
        "neutral",
        "brand",
      ],
    },
  },

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || "http://localhost:4000",
    },
  },

  vite: {
    server: {
      allowedHosts: [appUrlObject.hostname],
      hmr: {
        host: appUrlObject.hostname,
        protocol: appUrlObject.protocol === 'https:' ? 'wss' : 'ws',
        clientPort: hmrClientPort,
      },
    },
  },
});
