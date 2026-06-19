import type { SearchResultItem } from "~/types/search";

export const searchResultKindColorClassMap: Record<
  SearchResultItem["kind"],
  string
> = {
  "agency-site": "bg-slate-100 text-slate-700",
  blog: "bg-sky-50 text-sky-600",
  author: "bg-amber-50 text-amber-600",
  "seo-cluster": "bg-violet-50 text-violet-600",
  "blog-article": "bg-emerald-50 text-emerald-600",
  keyword: "bg-orange-50 text-orange-600",
};
