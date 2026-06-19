import type {
  ProblemSource,
  SearchIntent,
} from "~/types/customer-problems";

export const customerProblemSourceOptions: Array<{
  label: string;
  value: ProblemSource;
}> = [
  { label: "Interview client", value: "CUSTOMER_INTERVIEW" },
  { label: "Appel client", value: "CLIENT_CALL" },
  { label: "Commentaire YouTube", value: "YOUTUBE_COMMENT" },
  { label: "Email", value: "EMAIL" },
  { label: "Ticket support", value: "SUPPORT_TICKET" },
  { label: "Observation personnelle", value: "PERSONAL_OBSERVATION" },
  { label: "Autre", value: "OTHER" },
];

export const customerProblemIntentOptions: Array<{
  label: string;
  value: SearchIntent;
}> = [
  { label: "Informationnelle", value: "INFORMATIONAL" },
  { label: "Commerciale", value: "COMMERCIAL" },
  { label: "Transactionnelle", value: "TRANSACTIONAL" },
  { label: "Navigationnelle", value: "NAVIGATIONAL" },
];
