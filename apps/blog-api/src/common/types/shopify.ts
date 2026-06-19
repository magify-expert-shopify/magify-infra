export type ShopifyBlogListItem = {
  id: string;
  title: string;
  handle: string;
};

export type ShopifyPageListItem = {
  id: string;
  title: string;
  handle: string;
};

export type ShopifyImageListItem = {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

export type ShopifyBlogArticleListItem = {
  id: string;
  title: string;
  handle: string;
  publishedAt?: string | null;
  blog: {
    id: string;
    title: string;
    handle: string;
  };
  associatedBlogArticle?: {
    id: string;
    title: string;
    slug: string | null;
    status: string;
    pageId: string | null;
  } | null;
};

export type ShopifyArticle = {
  id: string;
  title: string;
  handle: string;
  publishedAt: string | null;
  body: string | null;
  summary: string | null;
  tags: string[];
  blog: {
    id: string;
    title: string;
    handle: string;
  } | null;
  associatedBlogArticle?: {
    id: string;
    title: string;
    slug: string | null;
    status: string;
    pageId: string | null;
  } | null;
};

export type ShopifyMetaobjectField = {
  key: string;
  value: string | null;
  reference?: {
    __typename: string;
    id: string;
    image?: {
      url: string;
      altText?: string | null;
      width?: number | null;
      height?: number | null;
    } | null;
    title?: string | null;
    handle?: string | null;
  } | null;
};

export type ShopifyAuthorMetaobject = {
  id: string;
  handle: string;
  type: string;
  updatedAt: string;
  fields: ShopifyMetaobjectField[];
};

export type UpdateShopifyAuthorInput = {
  displayName?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  shopifyAvatarId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  shopifyPageId?: string | null;
  linkedinProfileUrl?: string | null;
  slug?: string | null;
};
