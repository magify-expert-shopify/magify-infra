import type { BlogArticleStatus } from "~/types/domain";

export const pillarProgressStepLabels = [
  "Pilier choisi",
  "Rédigé",
  "Poussé",
  "Visible ou planifié",
] as const;

export const pillarProgressStatusLabels: Record<string, string> = {
  IDEA: "Pilier choisi",
  DRAFT: "Pilier choisi",
  READY_TO_PUBLISH: "Prêt à publier",
  PUSHED: "Publié mais masqué",
  PLANNED: "Visible ou planifié",
  PUBLISHED: "Visible ou planifié",
  ARCHIVED: "Archivé",
};

export function getPillarProgressStep(status?: BlogArticleStatus | null) {
  switch (status) {
    case "READY_TO_PUBLISH":
      return 2;
    case "PUSHED":
    case "ARCHIVED":
      return 3;
    case "PLANNED":
    case "PUBLISHED":
      return 4;
    case "IDEA":
    case "DRAFT":
    default:
      return 1;
  }
}
