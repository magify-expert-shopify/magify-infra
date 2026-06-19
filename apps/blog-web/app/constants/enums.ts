import type { SearchIntent } from "~/types/customer-problems";
import type { KeywordLengthType } from "~/types/keywords";

export const searchIntentLabels: Record<SearchIntent, string> = {
  INFORMATIONAL: "Informationnel",
  COMMERCIAL: "Commercial",
  TRANSACTIONAL: "Transactionnel",
  NAVIGATIONAL: "Navigationnel",
};

export const keywordLengthTypeLabels: Record<KeywordLengthType, string> = {
  SHORT_TAIL: "Court",
  MID_TAIL: "Moyen",
  LONG_TAIL: "Long",
};
