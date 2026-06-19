// https://nuxt.com/docs/api/configuration/nuxt-config
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

  vite: {},
});
