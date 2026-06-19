import type {
  ShopifyArticle,
  ShopifyAuthorMetaobject,
  ShopifyBlogListItem,
  ShopifyPageListItem,
  UpdateShopifyAuthorInput,
} from 'src/common/types';

export type ShopifyGraphqlVariables = Record<string, unknown>;

export type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: Array<string | number>;
    extensions?: Record<string, unknown>;
  }>;
};

export type ShopifyShopQueryResponse = {
  shop: {
    id: string;
    name: string;
    email: string;
    description: string | null;
    myshopifyDomain: string;
    primaryDomain: {
      host: string;
      url: string;
    };
  };
};

export type ShopifyBlogsQueryResponse = {
  blogs: {
    nodes: ShopifyBlogListItem[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

export type ShopifyPagesQueryResponse = {
  pages: {
    nodes: ShopifyPageListItem[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

export type ShopifyImagesQueryResponse = {
  files: {
    nodes: Array<{
      id: string;
      alt: string | null;
      image: {
        url: string;
        width: number | null;
        height: number | null;
      } | null;
    }>;
  };
};

export type ShopifyBlogArticlesQueryResponse = {
  blog: {
    id: string;
    title: string;
    handle: string;
    articles: {
      nodes: Array<{
        id: string;
        title: string;
        handle: string;
        publishedAt: string | null;
      }>;
    };
  } | null;
};

export type ShopifyAllBlogArticlesQueryResponse = {
  articles: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
      publishedAt: string | null;
      blog: {
        id: string;
        title: string;
        handle: string;
      } | null;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

export type ShopifyArticleQueryResponse = {
  article: ShopifyArticle | null;
};

export type ShopifyArticleMutationPayload = {
  article: {
    id: string;
    title: string;
    handle: string;
    blog: {
      id: string;
      title: string;
      handle: string;
    } | null;
  } | null;
  userErrors: Array<{
    field?: string[] | null;
    message: string;
  }>;
};

export type ShopifyArticleCreateMutationResponse = {
  articleCreate: ShopifyArticleMutationPayload;
};

export type ShopifyArticleUpdateMutationResponse = {
  articleUpdate: ShopifyArticleMutationPayload;
};

export type ShopifyMetaobjectFieldInput = {
  key: string;
  value: string;
};

export type ShopifyAuthorMetaobjectUpsertInput = UpdateShopifyAuthorInput & {
  handle: string;
};

export type ShopifyMetaobjectDefinitionFieldDefinition = {
  key: string;
  name?: string;
  description?: string | null;
  type?: {
    name: string;
  };
};

export type ShopifyMetaobjectDefinition = {
  id: string;
  name: string;
  type: string;
  displayNameKey?: string | null;
  fieldDefinitions: ShopifyMetaobjectDefinitionFieldDefinition[];
};

export type ShopifyAuthorMetaobjectsQueryResponse = {
  metaobjects: {
    nodes: ShopifyAuthorMetaobject[];
  };
};

export type ShopifyAuthorMetaobjectQueryResponse = {
  metaobject: ShopifyAuthorMetaobject | null;
};

export type ShopifyAuthorMetaobjectSummary = Pick<
  ShopifyAuthorMetaobject,
  'id' | 'handle' | 'type' | 'updatedAt'
> & {
  fields: Array<{
    key: string;
    value: string | null;
  }>;
};

export type ShopifyAuthorMetaobjectsSummaryQueryResponse = {
  metaobjects: {
    nodes: ShopifyAuthorMetaobjectSummary[];
  };
};

export type ShopifyMetaobjectDefinitionsQueryResponse = {
  metaobjectDefinitions: {
    nodes: ShopifyMetaobjectDefinition[];
  };
};

export type ShopifyMetaobjectMutationUserError = {
  field?: string[] | null;
  message: string;
};

export type ShopifyMetaobjectMutationPayload = {
  metaobject: ShopifyAuthorMetaobject | null;
  userErrors: ShopifyMetaobjectMutationUserError[];
};

export type ShopifyMetaobjectCreateMutationResponse = {
  metaobjectCreate: ShopifyMetaobjectMutationPayload;
};

export type ShopifyMetaobjectUpdateMutationResponse = {
  metaobjectUpdate: ShopifyMetaobjectMutationPayload;
};

export type ShopifyMetaobjectUpsertMutationResponse = {
  metaobjectUpsert: ShopifyMetaobjectMutationPayload;
};

export type ShopifyMetaobjectDefinitionMutationPayload = {
  metaobjectDefinition: ShopifyMetaobjectDefinition | null;
  userErrors: Array<{
    field?: string[] | null;
    message: string;
    code?: string | null;
  }>;
};

export type ShopifyMetaobjectDefinitionUpdateMutationResponse = {
  metaobjectDefinitionUpdate: ShopifyMetaobjectDefinitionMutationPayload;
};

export type ShopifyMetaobjectDeleteMutationResponse = {
  metaobjectDelete: {
    deletedId: string | null;
    userErrors: ShopifyMetaobjectMutationUserError[];
  };
};
