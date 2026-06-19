import { defaultKeywordDifficultyLevels } from "~/constants/keyword-difficulty";
import type { KeywordDifficultyLevel } from "~/types/settings";

const keywordDifficultyToneClasses = [
  "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  "bg-lime-50 text-lime-700 ring-1 ring-inset ring-lime-200",
  "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
] as const;

const keywordDifficultyTextClasses = [
  "text-emerald-700",
  "text-lime-700",
  "text-sky-700",
  "text-amber-700",
  "text-orange-700",
  "text-rose-700",
] as const;

const keywordDifficultyPrimaryClasses = [
  "bg-lime-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
] as const;

const keywordDifficultyRowClasses = [
  "bg-emerald-50/70",
  "bg-lime-50/70",
  "bg-sky-50/70",
  "bg-amber-50/70",
  "bg-orange-50/70",
  "bg-rose-50/70",
] as const;

function normalizeKeywordDifficultyLevels(levels: KeywordDifficultyLevel[]) {
  return [...levels]
    .filter(
      (level) =>
        level.label.trim() &&
        typeof level.maxScore === "number" &&
        Number.isFinite(level.maxScore),
    )
    .sort((left, right) => left.maxScore - right.maxScore);
}

export function resolveKeywordDifficultyLevel(
  difficulty: number | null | undefined,
  levels: KeywordDifficultyLevel[] = defaultKeywordDifficultyLevels,
) {
  if (typeof difficulty !== "number" || !Number.isFinite(difficulty)) {
    return null;
  }

  const normalizedLevels = normalizeKeywordDifficultyLevels(levels);
  const matchedIndex = normalizedLevels.findIndex(
    (level) => difficulty <= level.maxScore,
  );

  if (matchedIndex === -1) {
    const fallbackLevel = normalizedLevels.at(-1);

    return fallbackLevel
      ? {
          level: fallbackLevel,
          index: normalizedLevels.length - 1,
        }
      : null;
  }

  return {
    level: normalizedLevels[matchedIndex]!,
    index: matchedIndex,
  };
}

export function getKeywordDifficultyLabel(
  difficulty: number | null | undefined,
  levels: KeywordDifficultyLevel[] = defaultKeywordDifficultyLevels,
) {
  return resolveKeywordDifficultyLevel(difficulty, levels)?.level.label ?? "-";
}

export function getKeywordDifficultyToneClass(
  difficulty: number | null | undefined,
  levels: KeywordDifficultyLevel[] = defaultKeywordDifficultyLevels,
) {
  const resolvedLevel = resolveKeywordDifficultyLevel(difficulty, levels);

  if (!resolvedLevel) {
    return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";
  }

  return (
    keywordDifficultyToneClasses[
      Math.min(resolvedLevel.index, keywordDifficultyToneClasses.length - 1)
    ] ?? keywordDifficultyToneClasses.at(-1)!
  );
}

export function getKeywordDifficultyTextClass(
  difficulty: number | null | undefined,
  levels: KeywordDifficultyLevel[] = defaultKeywordDifficultyLevels,
) {
  const resolvedLevel = resolveKeywordDifficultyLevel(difficulty, levels);

  if (!resolvedLevel) {
    return "text-slate-600";
  }

  return (
    keywordDifficultyTextClasses[
      Math.min(resolvedLevel.index, keywordDifficultyTextClasses.length - 1)
    ] ?? keywordDifficultyTextClasses.at(-1)!
  );
}

export function getKeywordDifficultyClass(
  difficulty: number | null | undefined,
  levels: KeywordDifficultyLevel[] = defaultKeywordDifficultyLevels,
) {
  const resolvedLevel = resolveKeywordDifficultyLevel(difficulty, levels);

  if (!resolvedLevel) {
    return "bg-slate-300";
  }

  return (
    keywordDifficultyPrimaryClasses[
      Math.min(
        resolvedLevel.index,
        keywordDifficultyPrimaryClasses.length - 1,
      )
    ] ?? keywordDifficultyPrimaryClasses.at(-1)!
  );
}

export function getKeywordDifficultyRowToneClass(
  difficulty: number | null | undefined,
  levels: KeywordDifficultyLevel[] = defaultKeywordDifficultyLevels,
) {
  const resolvedLevel = resolveKeywordDifficultyLevel(difficulty, levels);

  if (!resolvedLevel) {
    return "bg-slate-50/70";
  }

  return (
    keywordDifficultyRowClasses[
      Math.min(resolvedLevel.index, keywordDifficultyRowClasses.length - 1)
    ] ?? keywordDifficultyRowClasses.at(-1)!
  );
}

export function getKeywordDifficultySortRank(
  difficulty: number | null | undefined,
  levels: KeywordDifficultyLevel[] = defaultKeywordDifficultyLevels,
) {
  const resolvedLevel = resolveKeywordDifficultyLevel(difficulty, levels);

  return resolvedLevel?.index ?? Number.POSITIVE_INFINITY;
}
