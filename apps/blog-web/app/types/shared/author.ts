export const AuthorSource = {
  MAGIFY: "MAGIFY",
  COMPETITOR: "COMPETITOR",
  PARTNER: "PARTNER",
  OTHER: "OTHER",
} as const;

export type AuthorSource =
  (typeof AuthorSource)[keyof typeof AuthorSource];
