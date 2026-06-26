// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath, URL } from "node:url";

const appUrl =
  process.env.APP_URL?.trim() ||
  `http://localhost:${Number(process.env.PORT || 3000)}`;
const appUrlObject = new URL(appUrl);
const isDevProxyHost = appUrlObject.hostname.endsWith(".dev.magify.local");
const hmrClientPort = isDevProxyHost ? 80 : Number(process.env.PORT || 3000);

console.info(`[blog-web] available at ${appUrl}`);

export default defineNuxtConfig({
  devServer: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3000),
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  runtimeConfig: {
    supabaseSecretKey: "",
    apiInternalUrl: "http://magify-blog-api-prod:4001",
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
        protocol: appUrlObject.protocol === "https:" ? "wss" : "ws",
        clientPort: hmrClientPort,
      },
    },
    optimizeDeps: {
      include: [
        "@codemirror/commands",
        "@codemirror/lang-html",
        "@codemirror/language",
        "@codemirror/state",
        "@codemirror/view",

        "@tiptap/core",
        "@tiptap/extension-code-block",
        "@tiptap/extension-color",
        "@tiptap/extension-highlight",
        "@tiptap/extension-image",
        "@tiptap/extension-link",
        "@tiptap/extension-placeholder",
        "@tiptap/extension-table",
        "@tiptap/extension-table-cell",
        "@tiptap/extension-table-header",
        "@tiptap/extension-table-row",
        "@tiptap/extension-text-align",
        "@tiptap/extension-text-style",
        "@tiptap/extension-underline",
        "@tiptap/pm/model",
        "@tiptap/pm/state",
        "@tiptap/pm/view",
        "@tiptap/starter-kit",
        "@tiptap/vue-3",
      ],
    },
  },
});
