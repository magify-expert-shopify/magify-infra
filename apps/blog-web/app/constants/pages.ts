import type { ClusterPage } from "~/types/domain";
import type { PageStatus } from "~/types/pages";

type PageType = ClusterPage["pageType"];
type SeoRole = ClusterPage["seoRole"];

export const pageTypeLabels: Record<PageType, string> = {
  BLOG_ARTICLE: "Article de blog",
  PRODUCT_PAGE: "Page produit",
  COLLECTION: "Collection",
  LANDING_PAGE: "Landing page",
  SERVICE_PAGE: "Page service / Page d'offre",
  CATEGORY_PAGE: "Page catégorie",
  TUTORIAL: "Tutoriel",
  GUIDE: "Guide",
  DEFINITION: "Définition",
  FORM: "Formulaire",
  HOMEPAGE: "Page d'accueil",
  FAQ: "FAQ",
  OTHER: "Page",
};

export const seoRoleLabels: Record<SeoRole, string> = {
  PILLAR: "Pilier",
  SATELLITE: "Satellite",
  SUPPORT: "Support",
};

export const pageStatusLabels: Record<PageStatus, string> = {
  IDEA: "Idée",
  DRAFT: "Brouillon",
  PLANNED: "Planifiée",
  READY_TO_PUBLISH: "Prête à publier",
  PUSHED: "Poussée",
  PUBLISHED: "Publiée",
  ARCHIVED: "Archivée",
};

export const pageStatusOptions = Object.entries(pageStatusLabels).map(
  ([value, label]) => ({
    value: value as PageStatus,
    label,
  }),
);
