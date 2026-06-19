-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "shopifyStoreDomain" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupabaseUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "displayName" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_supabaseUserId_fkey" FOREIGN KEY ("supabaseUserId") REFERENCES "SupabaseUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KeywordGroupAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keywordGroupId" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeywordGroupAssignment_keywordGroupId_fkey" FOREIGN KEY ("keywordGroupId") REFERENCES "KeywordGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KeywordGroupAssignment_supabaseUserId_fkey" FOREIGN KEY ("supabaseUserId") REFERENCES "SupabaseUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetitorAgencySite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "projectId" TEXT,
    "lastScannedAt" DATETIME,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompetitorAgencySite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Blog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "baseUrl" TEXT NOT NULL,
    "shopifyBlogId" TEXT,
    "feedUrl" TEXT,
    "slug" TEXT,
    "title" TEXT,
    "description" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "languageCode" TEXT,
    "projectId" TEXT,
    "lastScannedAt" DATETIME,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "competitorAgencySiteId" TEXT NOT NULL,
    CONSTRAINT "Blog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Blog_competitorAgencySiteId_fkey" FOREIGN KEY ("competitorAgencySiteId") REFERENCES "CompetitorAgencySite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "jobTitle" TEXT,
    "slug" TEXT,
    "bio" TEXT,
    "profileUrl" TEXT,
    "shopifyAvatarId" TEXT,
    "shopifyPageId" TEXT,
    "linkedinProfileUrl" TEXT,
    "avatarUrl" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "shopifyMetaobjectId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'COMPETITOR',
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "siteId" TEXT,
    CONSTRAINT "Author_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CompetitorAgencySite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlogArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT,
    "primaryKeyword" TEXT,
    "requiredKeywords" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "videoYoutubeUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "shopifyArticleId" TEXT,
    "shopifyBlogId" TEXT,
    "pageId" TEXT,
    "projectId" TEXT,
    "reviewSupabaseUserId" TEXT,
    "publishedAt" DATETIME,
    "plannedFor" DATETIME,
    "reviewAssignedAt" DATETIME,
    "reviewDueAt" DATETIME,
    "reviewCompletedAt" DATETIME,
    "reviewOutcome" TEXT,
    "reviewComment" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScannedAt" DATETIME,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "blogId" TEXT,
    "clusterId" TEXT,
    "authorId" TEXT,
    CONSTRAINT "BlogArticle_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogArticle_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogArticle_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogArticle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogArticle_reviewSupabaseUserId_fkey" FOREIGN KEY ("reviewSupabaseUserId") REFERENCES "SupabaseUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlogArticleScriptAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blogArticleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BlogArticleScriptAsset_blogArticleId_fkey" FOREIGN KEY ("blogArticleId") REFERENCES "BlogArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "volume" INTEGER,
    "difficulty" INTEGER,
    "searchIntent" TEXT,
    "searchIntentDescription" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OTHER',
    "lengthType" TEXT,
    "template" TEXT,
    "trashedAt" DATETIME,
    "lastScannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "keywordGroupId" TEXT,
    "clusterId" TEXT,
    "pageId" TEXT,
    "customerProblemId" TEXT,
    CONSTRAINT "Keyword_keywordGroupId_fkey" FOREIGN KEY ("keywordGroupId") REFERENCES "KeywordGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Keyword_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Keyword_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Keyword_customerProblemId_fkey" FOREIGN KEY ("customerProblemId") REFERENCES "CustomerProblem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Keyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InternalLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromPageId" TEXT NOT NULL,
    "toPageId" TEXT NOT NULL,
    "projectId" TEXT,
    "anchorText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalLink_fromPageId_fkey" FOREIGN KEY ("fromPageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InternalLink_toPageId_fkey" FOREIGN KEY ("toPageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InternalLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pageType" TEXT NOT NULL DEFAULT 'OTHER',
    "seoRole" TEXT NOT NULL,
    "searchIntent" TEXT,
    "projectId" TEXT,
    "clusterId" TEXT,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Page_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoCluster" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Page_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PagePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keywordGroupId" TEXT NOT NULL,
    "pageId" TEXT,
    "projectId" TEXT,
    "pageType" TEXT NOT NULL,
    "subjectExact" TEXT NOT NULL,
    "primaryKeyword" TEXT NOT NULL,
    "secondaryKeywords" TEXT,
    "target" TEXT NOT NULL,
    "conversionObjective" TEXT NOT NULL,
    "approxLength" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PagePlan_keywordGroupId_fkey" FOREIGN KEY ("keywordGroupId") REFERENCES "KeywordGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PagePlan_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PagePlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeoCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentClusterId" TEXT,
    "pillarKeywordGroupId" TEXT,
    "slug" TEXT,
    "icon" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isSprintCluster" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "primaryKeyword" TEXT NOT NULL,
    "notes" TEXT,
    "projectId" TEXT,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeoCluster_parentClusterId_fkey" FOREIGN KEY ("parentClusterId") REFERENCES "SeoCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SeoCluster_pillarKeywordGroupId_fkey" FOREIGN KEY ("pillarKeywordGroupId") REFERENCES "KeywordGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SeoCluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clusterId" TEXT,
    "blogArticleTargetCount" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "durationDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sprint_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KeywordGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "primaryKeyword" TEXT,
    "description" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "parentGroupId" TEXT,
    "projectId" TEXT,
    "seoClusterId" TEXT,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeywordGroup_seoClusterId_fkey" FOREIGN KEY ("seoClusterId") REFERENCES "SeoCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KeywordGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "KeywordGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KeywordGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerProblemCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "projectId" TEXT,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerProblemCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerProblem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "intention" TEXT,
    "categoryId" TEXT,
    "projectId" TEXT,
    "trashedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerProblem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CustomerProblemCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerProblem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataForSeoCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "requestPayload" TEXT NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "KeywordSiteVisibilityObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "keywordId" TEXT,
    "keywordText" TEXT NOT NULL,
    "keywordVolume" INTEGER,
    "keywordDifficulty" INTEGER,
    "keywordIntent" TEXT,
    "pageId" TEXT,
    "pageUrl" TEXT NOT NULL,
    "siteBaseUrl" TEXT NOT NULL,
    "siteHostname" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "serpResponseBody" TEXT NOT NULL,
    "sourceCacheKey" TEXT NOT NULL,
    "sourceCacheCreatedAt" DATETIME NOT NULL,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeywordSiteVisibilityObservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KeywordSiteVisibilityObservation_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KeywordSiteVisibilityObservation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoogleSuggestCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "requestPayload" TEXT NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "OpenAiCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "promptType" TEXT NOT NULL DEFAULT 'OTHER',
    "cacheKey" TEXT NOT NULL,
    "requestPayload" TEXT NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromptConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "inputTemplate" TEXT NOT NULL,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 1200,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_AuthorToBlog" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AuthorToBlog_A_fkey" FOREIGN KEY ("A") REFERENCES "Author" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AuthorToBlog_B_fkey" FOREIGN KEY ("B") REFERENCES "Blog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_KeywordGroupMultiParents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_KeywordGroupMultiParents_A_fkey" FOREIGN KEY ("A") REFERENCES "KeywordGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_KeywordGroupMultiParents_B_fkey" FOREIGN KEY ("B") REFERENCES "KeywordGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CustomerProblemCategoryToSeoCluster" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CustomerProblemCategoryToSeoCluster_A_fkey" FOREIGN KEY ("A") REFERENCES "CustomerProblemCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CustomerProblemCategoryToSeoCluster_B_fkey" FOREIGN KEY ("B") REFERENCES "SeoCluster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CustomerProblemToSeoCluster" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CustomerProblemToSeoCluster_A_fkey" FOREIGN KEY ("A") REFERENCES "CustomerProblem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CustomerProblemToSeoCluster_B_fkey" FOREIGN KEY ("B") REFERENCES "SeoCluster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupabaseUser_email_key" ON "SupabaseUser"("email");

-- CreateIndex
CREATE INDEX "SupabaseUser_displayName_idx" ON "SupabaseUser"("displayName");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_supabaseUserId_idx" ON "ProjectMember"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_supabaseUserId_key" ON "ProjectMember"("projectId", "supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordGroupAssignment_keywordGroupId_key" ON "KeywordGroupAssignment"("keywordGroupId");

-- CreateIndex
CREATE INDEX "KeywordGroupAssignment_supabaseUserId_idx" ON "KeywordGroupAssignment"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorAgencySite_baseUrl_key" ON "CompetitorAgencySite"("baseUrl");

-- CreateIndex
CREATE INDEX "CompetitorAgencySite_projectId_idx" ON "CompetitorAgencySite"("projectId");

-- CreateIndex
CREATE INDEX "Blog_competitorAgencySiteId_idx" ON "Blog"("competitorAgencySiteId");

-- CreateIndex
CREATE INDEX "Blog_projectId_idx" ON "Blog"("projectId");

-- CreateIndex
CREATE INDEX "Blog_shopifyBlogId_idx" ON "Blog"("shopifyBlogId");

-- CreateIndex
CREATE UNIQUE INDEX "Blog_competitorAgencySiteId_baseUrl_key" ON "Blog"("competitorAgencySiteId", "baseUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Author_email_key" ON "Author"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Author_shopifyMetaobjectId_key" ON "Author"("shopifyMetaobjectId");

-- CreateIndex
CREATE INDEX "Author_name_idx" ON "Author"("name");

-- CreateIndex
CREATE INDEX "Author_source_idx" ON "Author"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Author_name_profileUrl_key" ON "Author"("name", "profileUrl");

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_url_key" ON "BlogArticle"("url");

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_shopifyArticleId_key" ON "BlogArticle"("shopifyArticleId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_pageId_key" ON "BlogArticle"("pageId");

-- CreateIndex
CREATE INDEX "BlogArticle_authorId_idx" ON "BlogArticle"("authorId");

-- CreateIndex
CREATE INDEX "BlogArticle_blogId_idx" ON "BlogArticle"("blogId");

-- CreateIndex
CREATE INDEX "BlogArticle_clusterId_idx" ON "BlogArticle"("clusterId");

-- CreateIndex
CREATE INDEX "BlogArticle_pageId_idx" ON "BlogArticle"("pageId");

-- CreateIndex
CREATE INDEX "BlogArticle_projectId_idx" ON "BlogArticle"("projectId");

-- CreateIndex
CREATE INDEX "BlogArticle_publishedAt_idx" ON "BlogArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "BlogArticle_reviewDueAt_idx" ON "BlogArticle"("reviewDueAt");

-- CreateIndex
CREATE INDEX "BlogArticle_reviewSupabaseUserId_idx" ON "BlogArticle"("reviewSupabaseUserId");

-- CreateIndex
CREATE INDEX "BlogArticle_shopifyBlogId_idx" ON "BlogArticle"("shopifyBlogId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_blogId_slug_key" ON "BlogArticle"("blogId", "slug");

-- CreateIndex
CREATE INDEX "BlogArticleScriptAsset_blogArticleId_idx" ON "BlogArticleScriptAsset"("blogArticleId");

-- CreateIndex
CREATE INDEX "BlogArticleScriptAsset_position_idx" ON "BlogArticleScriptAsset"("position");

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticleScriptAsset_blogArticleId_url_key" ON "BlogArticleScriptAsset"("blogArticleId", "url");

-- CreateIndex
CREATE INDEX "Keyword_clusterId_idx" ON "Keyword"("clusterId");

-- CreateIndex
CREATE INDEX "Keyword_customerProblemId_idx" ON "Keyword"("customerProblemId");

-- CreateIndex
CREATE INDEX "Keyword_keyword_idx" ON "Keyword"("keyword");

-- CreateIndex
CREATE INDEX "Keyword_keywordGroupId_idx" ON "Keyword"("keywordGroupId");

-- CreateIndex
CREATE INDEX "Keyword_projectId_idx" ON "Keyword"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_customerProblemId_keyword_key" ON "Keyword"("customerProblemId", "keyword");

-- CreateIndex
CREATE INDEX "InternalLink_fromPageId_idx" ON "InternalLink"("fromPageId");

-- CreateIndex
CREATE INDEX "InternalLink_projectId_idx" ON "InternalLink"("projectId");

-- CreateIndex
CREATE INDEX "InternalLink_toPageId_idx" ON "InternalLink"("toPageId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalLink_fromPageId_toPageId_key" ON "InternalLink"("fromPageId", "toPageId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_url_key" ON "Page"("url");

-- CreateIndex
CREATE INDEX "Page_projectId_idx" ON "Page"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PagePlan_keywordGroupId_key" ON "PagePlan"("keywordGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "PagePlan_pageId_key" ON "PagePlan"("pageId");

-- CreateIndex
CREATE INDEX "PagePlan_pageId_idx" ON "PagePlan"("pageId");

-- CreateIndex
CREATE INDEX "PagePlan_projectId_idx" ON "PagePlan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoCluster_pillarKeywordGroupId_key" ON "SeoCluster"("pillarKeywordGroupId");

-- CreateIndex
CREATE INDEX "SeoCluster_name_idx" ON "SeoCluster"("name");

-- CreateIndex
CREATE INDEX "SeoCluster_parentClusterId_idx" ON "SeoCluster"("parentClusterId");

-- CreateIndex
CREATE INDEX "SeoCluster_primaryKeyword_idx" ON "SeoCluster"("primaryKeyword");

-- CreateIndex
CREATE INDEX "SeoCluster_projectId_idx" ON "SeoCluster"("projectId");

-- CreateIndex
CREATE INDEX "Sprint_clusterId_idx" ON "Sprint"("clusterId");

-- CreateIndex
CREATE INDEX "KeywordGroup_name_idx" ON "KeywordGroup"("name");

-- CreateIndex
CREATE INDEX "KeywordGroup_primaryKeyword_idx" ON "KeywordGroup"("primaryKeyword");

-- CreateIndex
CREATE INDEX "KeywordGroup_isFavorite_idx" ON "KeywordGroup"("isFavorite");

-- CreateIndex
CREATE INDEX "KeywordGroup_parentGroupId_idx" ON "KeywordGroup"("parentGroupId");

-- CreateIndex
CREATE INDEX "KeywordGroup_seoClusterId_idx" ON "KeywordGroup"("seoClusterId");

-- CreateIndex
CREATE INDEX "KeywordGroup_projectId_idx" ON "KeywordGroup"("projectId");

-- CreateIndex
CREATE INDEX "CustomerProblemCategory_projectId_idx" ON "CustomerProblemCategory"("projectId");

-- CreateIndex
CREATE INDEX "CustomerProblemCategory_title_idx" ON "CustomerProblemCategory"("title");

-- CreateIndex
CREATE INDEX "CustomerProblem_categoryId_idx" ON "CustomerProblem"("categoryId");

-- CreateIndex
CREATE INDEX "CustomerProblem_source_idx" ON "CustomerProblem"("source");

-- CreateIndex
CREATE INDEX "CustomerProblem_intention_idx" ON "CustomerProblem"("intention");

-- CreateIndex
CREATE INDEX "CustomerProblem_projectId_idx" ON "CustomerProblem"("projectId");

-- CreateIndex
CREATE INDEX "CustomerProblem_title_idx" ON "CustomerProblem"("title");

-- CreateIndex
CREATE UNIQUE INDEX "DataForSeoCache_cacheKey_key" ON "DataForSeoCache"("cacheKey");

-- CreateIndex
CREATE INDEX "DataForSeoCache_endpoint_idx" ON "DataForSeoCache"("endpoint");

-- CreateIndex
CREATE INDEX "DataForSeoCache_lastUsedAt_idx" ON "DataForSeoCache"("lastUsedAt");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_keywordId_idx" ON "KeywordSiteVisibilityObservation"("keywordId");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_keywordText_idx" ON "KeywordSiteVisibilityObservation"("keywordText");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_observedAt_idx" ON "KeywordSiteVisibilityObservation"("observedAt");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_pageId_idx" ON "KeywordSiteVisibilityObservation"("pageId");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_projectId_idx" ON "KeywordSiteVisibilityObservation"("projectId");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_siteBaseUrl_idx" ON "KeywordSiteVisibilityObservation"("siteBaseUrl");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_siteHostname_idx" ON "KeywordSiteVisibilityObservation"("siteHostname");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_position_idx" ON "KeywordSiteVisibilityObservation"("position");

-- CreateIndex
CREATE INDEX "KeywordSiteVisibilityObservation_sourceCacheCreatedAt_idx" ON "KeywordSiteVisibilityObservation"("sourceCacheCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordSiteVisibilityObservation_sourceCacheKey_pageUrl_key" ON "KeywordSiteVisibilityObservation"("sourceCacheKey", "pageUrl");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleSuggestCache_cacheKey_key" ON "GoogleSuggestCache"("cacheKey");

-- CreateIndex
CREATE INDEX "GoogleSuggestCache_endpoint_idx" ON "GoogleSuggestCache"("endpoint");

-- CreateIndex
CREATE INDEX "GoogleSuggestCache_lastUsedAt_idx" ON "GoogleSuggestCache"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpenAiCache_cacheKey_key" ON "OpenAiCache"("cacheKey");

-- CreateIndex
CREATE INDEX "OpenAiCache_endpoint_idx" ON "OpenAiCache"("endpoint");

-- CreateIndex
CREATE INDEX "OpenAiCache_lastUsedAt_idx" ON "OpenAiCache"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PromptConfig_key_key" ON "PromptConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "_AuthorToBlog_AB_unique" ON "_AuthorToBlog"("A", "B");

-- CreateIndex
CREATE INDEX "_AuthorToBlog_B_index" ON "_AuthorToBlog"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_KeywordGroupMultiParents_AB_unique" ON "_KeywordGroupMultiParents"("A", "B");

-- CreateIndex
CREATE INDEX "_KeywordGroupMultiParents_B_index" ON "_KeywordGroupMultiParents"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CustomerProblemCategoryToSeoCluster_AB_unique" ON "_CustomerProblemCategoryToSeoCluster"("A", "B");

-- CreateIndex
CREATE INDEX "_CustomerProblemCategoryToSeoCluster_B_index" ON "_CustomerProblemCategoryToSeoCluster"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CustomerProblemToSeoCluster_AB_unique" ON "_CustomerProblemToSeoCluster"("A", "B");

-- CreateIndex
CREATE INDEX "_CustomerProblemToSeoCluster_B_index" ON "_CustomerProblemToSeoCluster"("B");
