// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      dashboardBlogUrl: "http://blog.dev.magify.duckdns.org",
      dashboardProspectionUrl: "http://prospection.dev.magify.duckdns.org",
      dashboardSocialUrl: "http://social.dev.magify.duckdns.org",
      dashboardProxyManagerUrl: "http://admin.dev.magify.duckdns.org",
      dashboardBlogApiUrl: "http://blog-api.dev.magify.duckdns.org",
      dashboardProspectionApiUrl: "http://prospection-api.dev.magify.duckdns.org",
      dashboardSocialApiUrl: "http://social-api.dev.magify.duckdns.org",
    },
  },
  app: {
    head: {
      title: "Magify Dashboard",
      meta: [
        {
          name: "description",
          content: "Point d'entrée des applications Magify",
        },
      ],
    },
  },
  nitro: {
    preset: "static",
  },
})
