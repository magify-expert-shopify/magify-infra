import type { BlogArticleStatus } from "~/types/domain";

export const blogArticleStatusOptions: Array<{
  value: BlogArticleStatus;
  label: string;
}> = [
  {
    value: "IDEA",
    label: "Marquer comme ebauche",
  },
  {
    value: "DRAFT",
    label: "Mettre en brouillon",
  },
  {
    value: "READY_TO_PUBLISH",
    label: "Marquer comme prêt à publier",
  },
  {
    value: "PUSHED",
    label: "Pousser vers Shopify (masqué)",
  },
  {
    value: "PUBLISHED",
    label: "Publier l'article sur Shopify",
  },
  {
    value: "ARCHIVED",
    label: "Archiver l'article",
  },
];

export const blogArticleStatusLabels: Record<BlogArticleStatus, string> = {
  IDEA: "Ébauche",
  DRAFT: "Brouillon",
  READY_TO_PUBLISH: "Prêt à publier",
  PLANNED: "Planifié",
  PUSHED: "Poussé vers Shopify",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
};

export const blogArticleStatusIcons: Record<BlogArticleStatus, string> = {
  IDEA: "i-lucide-lightbulb",
  DRAFT: "i-lucide-file-pen-line",
  READY_TO_PUBLISH: "i-lucide-file-check-2",
  PLANNED: "i-lucide-calendar-clock",
  PUSHED: "i-lucide-send",
  PUBLISHED: "i-lucide-badge-check",
  ARCHIVED: "i-lucide-archive",
};

export const blogArticleStatusCardClasses: Record<BlogArticleStatus, string> = {
  IDEA: "border-slate-200 bg-slate-50",
  DRAFT: "border-slate-200 bg-slate-50",
  READY_TO_PUBLISH: "border-slate-200 bg-slate-50",
  PLANNED: "border-slate-200 bg-slate-50",
  PUSHED: "border-slate-200 bg-slate-50",
  PUBLISHED: "border-slate-200 bg-slate-50",
  ARCHIVED: "border-slate-200 bg-slate-50",
};

export const blogArticleStatusIconBadgeClasses: Record<BlogArticleStatus, string> = {
  IDEA: "bg-amber-50 text-amber-700 ring-amber-100",
  DRAFT: "bg-slate-50 text-slate-700 ring-slate-100",
  READY_TO_PUBLISH: "bg-sky-50 text-sky-700 ring-sky-100",
  PLANNED: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  PUSHED: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  ARCHIVED: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

export const blogArticleStatusActionIconClasses: Record<BlogArticleStatus, string> = {
  IDEA: "border-amber-200 bg-white text-amber-700",
  DRAFT: "border-slate-200 bg-white text-slate-600",
  READY_TO_PUBLISH: "border-sky-200 bg-white text-sky-700",
  PLANNED: "border-indigo-200 bg-white text-indigo-700",
  PUSHED: "border-cyan-200 bg-white text-cyan-700",
  PUBLISHED: "border-emerald-200 bg-white text-emerald-700",
  ARCHIVED: "border-zinc-200 bg-white text-zinc-600",
};
