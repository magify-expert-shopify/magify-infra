import type { KeywordDifficultyLevel } from "~/types/settings";

export const defaultKeywordDifficultyLevels: KeywordDifficultyLevel[] = [
  {
    label: "Très facile",
    maxScore: 14,
  },
  {
    label: "Facile",
    maxScore: 29,
  },
  {
    label: "Possible",
    maxScore: 49,
  },
  {
    label: "Difficile",
    maxScore: 69,
  },
  {
    label: "Très difficile",
    maxScore: 84,
  },
  {
    label: "Quasi impossible",
    maxScore: 100,
  },
];
