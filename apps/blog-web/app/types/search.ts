export type SearchResultKind =
  | "agency-site"
  | "blog"
  | "author"
  | "blog-article"
  | "seo-cluster"
  | "keyword";

export type SearchResultItem = {
  key: string;
  kind: SearchResultKind;
  icon: string;
  badge: string;
  title: string;
  subtitle: string;
  to: string;
};
