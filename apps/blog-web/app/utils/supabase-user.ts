import type { SupabaseAuthUser } from "~/types/supabase-auth";

function readUserMetadataString(
  user: SupabaseAuthUser | null | undefined,
  key: string,
) {
  const value = user?.userMetadata?.[key];

  return typeof value === "string" ? value.trim() : "";
}

export function getSupabaseUserDisplayName(
  user: SupabaseAuthUser | null | undefined,
) {
  const candidates = [
    readUserMetadataString(user, "full_name"),
    readUserMetadataString(user, "name"),
    readUserMetadataString(user, "username"),
    readUserMetadataString(user, "display_name"),
    user?.email?.trim() ?? "",
  ];

  return candidates.find((value) => Boolean(value)) ?? "";
}

