import { defaultKeywordVolumeThresholds } from "~/constants/keyword-volume";
import type { KeywordIntent } from "~/types/keyword-analysis";
import type { KeywordVolumeThresholdsSettings } from "~/types/settings";

type KeywordVolumeTier = "LOW" | "MEDIUM" | "HIGH" | null;

export function getKeywordVolumeTier(
  volume: number | null | undefined,
  thresholds: KeywordVolumeThresholdsSettings = defaultKeywordVolumeThresholds,
): KeywordVolumeTier {
  if (typeof volume !== "number" || !Number.isFinite(volume)) {
    return null;
  }

  if (volume >= thresholds.highMin) {
    return "HIGH";
  }

  if (volume <= thresholds.lowMax) {
    return "LOW";
  }

  return "MEDIUM";
}

export function getKeywordPriorityLevel(
  intent: KeywordIntent | null | undefined,
  volume: number | null | undefined,
  thresholds: KeywordVolumeThresholdsSettings = defaultKeywordVolumeThresholds,
) {
  if (intent === "TRANSACTIONAL" || intent === "COMMERCIAL") {
    return getKeywordVolumeTier(volume, thresholds) === "HIGH" ? 1 : 2;
  }

  if (intent === "INFORMATIONAL") {
    return 3;
  }

  if (intent === "NAVIGATIONAL") {
    return 4;
  }

  return null;
}

export function getKeywordPriorityLabel(
  intent: KeywordIntent | null | undefined,
  volume: number | null | undefined,
  thresholds: KeywordVolumeThresholdsSettings = defaultKeywordVolumeThresholds,
) {
  const priorityLevel = getKeywordPriorityLevel(intent, volume, thresholds);

  return priorityLevel ? `Niveau ${priorityLevel}` : "-";
}

export function isKeywordPriorityLevel(
  intent: KeywordIntent | null | undefined,
  volume: number | null | undefined,
  targetLevel: number,
  thresholds: KeywordVolumeThresholdsSettings = defaultKeywordVolumeThresholds,
) {
  return getKeywordPriorityLevel(intent, volume, thresholds) === targetLevel;
}

export function getKeywordPriorityToneClass(
  intent: KeywordIntent | null | undefined,
  volume: number | null | undefined,
  thresholds: KeywordVolumeThresholdsSettings = defaultKeywordVolumeThresholds,
) {
  const priorityLevel = getKeywordPriorityLevel(intent, volume, thresholds);

  switch (priorityLevel) {
    case 1:
      return "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200";
    case 2:
      return "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200";
    case 3:
      return "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200";
    case 4:
      return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
    default:
      return "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200";
  }
}

export function getKeywordPriorityIntentRank(
  intent: KeywordIntent | null | undefined,
) {
  if (intent === "TRANSACTIONAL") {
    return 0;
  }

  if (intent === "COMMERCIAL") {
    return 1;
  }

  if (intent === "INFORMATIONAL") {
    return 2;
  }

  if (intent === "NAVIGATIONAL") {
    return 3;
  }

  return 4;
}
