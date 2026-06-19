import type { KeywordIntent } from "~/types/keyword-analysis";

export function formatKeywordIntent(intent: KeywordIntent | null | undefined) {
  if (intent === "TRANSACTIONAL") {
    return "Transactionnelle";
  }

  if (intent === "COMMERCIAL") {
    return "Commerciale";
  }

  if (intent === "NAVIGATIONAL") {
    return "Navigationnelle";
  }

  if (intent === "INFORMATIONAL") {
    return "Informationnelle";
  }

  return "-";
}

export function getKeywordIntentToneClass(
  intent: KeywordIntent | null | undefined,
) {
  if (intent === "TRANSACTIONAL") {
    return "text-emerald-700";
  }

  if (intent === "COMMERCIAL") {
    return "text-amber-700";
  }

  if (intent === "NAVIGATIONAL") {
    return "text-slate-700";
  }

  if (intent === "INFORMATIONAL") {
    return "text-sky-700";
  }

  return "text-slate-500";
}

export function getKeywordIntentIcon(
  intent: KeywordIntent | null | undefined,
) {
  if (intent === "TRANSACTIONAL") {
    return "i-lucide-shopping-cart";
  }

  if (intent === "COMMERCIAL") {
    return "i-lucide-badge-percent";
  }

  if (intent === "NAVIGATIONAL") {
    return "i-lucide-map-pinned";
  }

  if (intent === "INFORMATIONAL") {
    return "i-lucide-book-open-text";
  }

  return "i-lucide-target";
}
