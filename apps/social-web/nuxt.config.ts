// https://nuxt.com/docs/api/configuration/nuxt-config
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
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },
});
