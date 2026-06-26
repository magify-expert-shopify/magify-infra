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
    supabaseSecretKey: "",
    public: {
      apiUrl: "http://localhost:4000",
      supabaseUrl: "https://dfbjmfcqulkhjvhbkdti.supabase.co",
      supabaseAnonKey:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmptZmNxdWxraGp2aGJrZHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTIzMDIsImV4cCI6MjA5MDE4ODMwMn0.VHQF3iJLO6ynabcsi8GvZOddKOB7-mlHWM-ZVRGpyIU",
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
