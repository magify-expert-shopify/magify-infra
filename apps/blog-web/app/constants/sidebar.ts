import type { SidebarGroup } from "~/types/navigation";

export const sidebarItemGroups = [
  {
    title: "",
    tone: "slate",
    items: [
      {
        label: "Projets",
        to: "/projects",
        icon: "i-lucide-folders",
        visible: false,
      },
      {
        label: "Dashboard",
        to: "/",
        icon: "i-lucide-layout-dashboard",
      },
    ],
  },
  {
    title: "Rédaction",
    tone: "amber",
    items: [
      {
        label: "Suggestions",
        to: "/suggestions",
        icon: "i-lucide-lightbulb",
      },
      {
        label: "Planning éditorial",
        to: "/calendar",
        icon: "i-lucide-calendar-days",
      },
      {
        label: "Reviews",
        to: "/review",
        icon: "i-lucide-clipboard-list",
      },
      {
        label: "Suggestions d'articles",
        to: "/articles/suggestions",
        icon: "i-lucide-lightbulb",
        visible: false,
      },
    ],
  },
  {
    title: "Contenus",
    tone: "amber",
    items: [
      {
        label: "Pages",
        to: "/pages",
        icon: "i-lucide-file-text",
      },
      {
        label: "Articles",
        to: "/articles",
        icon: "i-lucide-file-stack",
      },
      {
        label: "Tutoriels",
        to: "/tutorials",
        icon: "i-lucide-graduation-cap",
      },
      {
        label: "Guides",
        to: "/guides",
        icon: "i-lucide-map",
      },
      {
        label: "Définitions",
        to: "/definitions",
        icon: "i-lucide-book-open-text",
      },
    ],
  },
  {
    title: "Cluster",
    tone: "sky",
    items: [
      {
        label: "Cluster",
        to: "/clusters",
        icon: "i-lucide-network",
      },
    ],
  },
  {
    title: "Mots-clés",
    tone: "emerald",
    items: [
      {
        label: "Idées",
        to: "/ideas",
        icon: "i-lucide-lightbulb",
        visible: false,
      },
      {
        label: "Magify",
        to: "/magify/business-positioning",
        icon: "i-lucide-target",
        visible: false,
      },
      {
        label: "Mots-clés",
        to: "/keywords/list",
        icon: "i-lucide-list",
      },
      {
        label: "Trouver des mots-clés",
        to: "/keywords/search",
        icon: "i-lucide-search",
      },
      {
        label: "Étude de mots-clés",
        to: "/keywords/research",
        icon: "i-lucide-scan-search",
      },
      {
        label: "Visibilité SERP",
        to: "/keywords/site-visibility",
        icon: "i-lucide-eye",
      },
      {
        label: "Regrouper les mots-clés",
        to: "/keywords/groups",
        icon: "i-lucide-list-ordered",
      },
      {
        label: "Regrouper les groupes",
        to: "/keywords/clusters",
        icon: "i-lucide-folder-tree",
      },
      {
        label: "Groupes",
        to: "/keyword-groups",
        icon: "i-lucide-group",
      },
      {
        label: "Choisir un template",
        to: "/templates",
        icon: "i-lucide-layout-template",
      },
    ],
  },
  {
    title: "Shopify",
    tone: "violet",
    items: [
      {
        label: "Blogs",
        to: "/shopify/blogs",
        icon: "i-lucide-rss",
      },
      {
        label: "Articles",
        to: "/shopify/blog-articles",
        icon: "i-lucide-file-text",
      },
      {
        label: "Auteurs",
        to: "/shopify/author",
        icon: "i-lucide-user",
      },
    ],
  },
  {
    title: "Concurrents",
    tone: "rose",
    visible: false,
    items: [
      {
        label: "Agences",
        to: "/competitor-agency-site",
        icon: "i-lucide-building-2",
      },
      {
        label: "Blogs",
        to: "/competitor-agency-blogs",
        icon: "i-lucide-rss",
      },
      {
        label: "Articles",
        to: "/competitor-agency-blog-articles",
        icon: "i-lucide-file-text",
      },
      {
        label: "Auteurs",
        to: "/competitor-agency-authors",
        icon: "i-lucide-user-round",
      },
    ],
  },
  {
    title: "Magify",
    tone: "cyan",
    visible: false,
    items: [
      {
        label: "FAQ",
        to: "/faq",
        icon: "i-lucide-circle-question-mark",
      },
      {
        label: "Miniature",
        to: "/thumbnail",
        icon: "i-lucide-image",
      },
      {
        label: "Problèmes",
        to: "/problems",
        icon: "i-lucide-bug",
      },
    ],
  },
  {
    title: "Paramètres",
    tone: "slate",
    items: [
      {
        label: "Statistiques",
        to: "/stats",
        icon: "i-lucide-chart-column",
        visible: false,
      },
      {
        label: "Aide",
        to: "/help",
        icon: "i-lucide-life-buoy",
        visible: false,
      },
      {
        label: "Paramètres",
        to: "/settings",
        icon: "i-lucide-settings-2",
      },
      {
        label: "Corbeille",
        to: "/settings/trash",
        icon: "i-lucide-trash",
        visible: false,
      },
    ],
  },
] as const satisfies readonly SidebarGroup[];
