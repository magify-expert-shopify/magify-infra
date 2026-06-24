// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      dashboardBlogUrl: process.env.NUXT_PUBLIC_DASHBOARD_BLOG_URL || "http://blog.dev.magify.local",
      dashboardProspectionUrl: process.env.NUXT_PUBLIC_DASHBOARD_PROSPECTION_URL || "http://prospection.dev.magify.local",
      dashboardSocialUrl: process.env.NUXT_PUBLIC_DASHBOARD_SOCIAL_URL || "http://social.dev.magify.local",
      dashboardProxyManagerUrl: process.env.NUXT_PUBLIC_DASHBOARD_PROXY_MANAGER_URL || "http://admin.dev.magify.local",
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
