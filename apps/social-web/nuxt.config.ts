// https://nuxt.com/docs/api/configuration/nuxt-config
const appUrl =
  process.env.APP_URL?.trim() ||
  `http://localhost:${Number(process.env.PORT || 3000)}`;
const appUrlObject = new URL(appUrl);
const isDevProxyHost = appUrlObject.hostname.endsWith('.dev.magify.local');
const hmrClientPort = isDevProxyHost ? 80 : Number(process.env.PORT || 3000);

console.info(`[social-web] available at ${appUrl}`);

export default defineNuxtConfig({
  devServer: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3000),
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  runtimeConfig: {
    supabaseSecretKey:
      process.env.SUPABASE_SECRET_KEY ??
      process.env.NUXT_PUBLIC_SUPABASE_SECRET_KEY,
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? "http://localhost:4000",
      supabaseUrl:
        process.env.NUXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
      supabaseAnonKey:
        process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY,
    },
  },

  modules: ["@nuxt/ui"],

  css: ["~/assets/css/main.css"],

  vite: {
    server: {
      allowedHosts: [appUrlObject.hostname],
      hmr: {
        host: appUrlObject.hostname,
        protocol: appUrlObject.protocol === 'https:' ? 'wss' : 'ws',
        clientPort: hmrClientPort,
      },
    },
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },
});
