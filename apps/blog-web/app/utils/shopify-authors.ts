import type { UpsertMagifyAuthorInput } from "~/types/authors";
import type { ShopifyAuthorMetaobject } from "~/types/shopify";

const shopifyAuthorFieldAliases = {
  displayName: ["name", "display_name", "title"],
  jobTitle: ["job_title"],
  shopifyAvatarId: ["avatar", "avatar_url", "image", "picture", "photo"],
  firstName: ["first_name", "firstname", "given_name"],
  lastName: ["last_name", "lastname", "family_name"],
  email: ["email", "mail"],
  phoneNumber: ["phone_number", "phone", "telephone"],
  bio: ["bio", "description"],
  shopifyPageId: ["page"],
  linkedinProfileUrl: ["linkedin_url", "linkedin_profile_url", "linkedin_profile", "linkedin"],
  slug: ["slug", "page_slug"],
} as const;

function normalizeShopifyAuthorFieldValue(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("{")) {
    try {
      const parsedValue = JSON.parse(value) as {
        url?: unknown;
        text?: unknown;
      };

      if (typeof parsedValue.url === "string" && parsedValue.url.trim()) {
        return parsedValue.url.trim();
      }

      if (typeof parsedValue.text === "string" && parsedValue.text.trim()) {
        return parsedValue.text.trim();
      }
    } catch {
      return value;
    }
  }

  return value;
}

export function getShopifyAuthorFieldValue(
  metaobject: ShopifyAuthorMetaobject,
  aliases: readonly string[],
) {
  for (const alias of aliases) {
    const rawValue =
      metaobject.fields.find((field) => field.key === alias)?.value?.trim() ||
      null;
    const value = normalizeShopifyAuthorFieldValue(rawValue);

    if (value) {
      return value;
    }
  }

  return null;
}

export function getShopifyAuthorFieldReference(
  metaobject: ShopifyAuthorMetaobject,
  aliases: readonly string[],
) {
  for (const alias of aliases) {
    const reference =
      metaobject.fields.find((field) => field.key === alias)?.reference ?? null;

    if (reference) {
      return reference;
    }
  }

  return null;
}

export function getShopifyAuthorDisplayName(metaobject: ShopifyAuthorMetaobject) {
  return (
    getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.displayName,
    ) || metaobject.handle
  );
}

export function toShopifyAuthorFormInput(
  metaobject: ShopifyAuthorMetaobject,
): UpsertMagifyAuthorInput {
  return {
    displayName: getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.displayName,
    ),
    jobTitle: getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.jobTitle,
    ),
    avatarUrl:
      getShopifyAuthorFieldReference(
        metaobject,
        shopifyAuthorFieldAliases.shopifyAvatarId,
      )?.image?.url ?? null,
    shopifyAvatarId:
      getShopifyAuthorFieldReference(
        metaobject,
        shopifyAuthorFieldAliases.shopifyAvatarId,
      )?.id ?? null,
    firstName: getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.firstName,
    ),
    lastName: getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.lastName,
    ),
    email: getShopifyAuthorFieldValue(metaobject, shopifyAuthorFieldAliases.email),
    phoneNumber: getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.phoneNumber,
    ),
    bio: getShopifyAuthorFieldValue(metaobject, shopifyAuthorFieldAliases.bio),
    shopifyPageId: getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.shopifyPageId,
    ),
    linkedinProfileUrl: getShopifyAuthorFieldValue(
      metaobject,
      shopifyAuthorFieldAliases.linkedinProfileUrl,
    ),
    slug:
      getShopifyAuthorFieldValue(metaobject, shopifyAuthorFieldAliases.slug) ||
      metaobject.handle,
  };
}
