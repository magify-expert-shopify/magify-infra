// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
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
