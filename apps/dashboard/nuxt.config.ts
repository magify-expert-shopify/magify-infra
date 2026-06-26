// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      dashboardBlogUrl: "http://blog.dev.magify.local",
      dashboardProspectionUrl: "http://prospection.dev.magify.local",
      dashboardSocialUrl: "http://social.dev.magify.local",
      dashboardProxyManagerUrl: "http://admin.dev.magify.local",
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
