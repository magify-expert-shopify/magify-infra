PRAGMA foreign_keys=OFF;

ALTER TABLE "KeywordGroup" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Keyword" ADD COLUMN "projectId" TEXT;
ALTER TABLE "InternalLink" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Page" ADD COLUMN "projectId" TEXT;
ALTER TABLE "SeoCluster" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CustomerProblemCategory" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CustomerProblem" ADD COLUMN "projectId" TEXT;
ALTER TABLE "CompetitorAgencySite" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Blog" ADD COLUMN "projectId" TEXT;
ALTER TABLE "BlogArticle" ADD COLUMN "projectId" TEXT;

CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "description" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Project_slug_key" ON "Project"("slug");
CREATE INDEX IF NOT EXISTS "Project_name_idx" ON "Project"("name");

CREATE TABLE IF NOT EXISTS "SupabaseUser" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT,
  "displayName" TEXT,
  "phone" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupabaseUser_email_key" ON "SupabaseUser"("email");
CREATE INDEX IF NOT EXISTS "SupabaseUser_displayName_idx" ON "SupabaseUser"("displayName");

CREATE TABLE IF NOT EXISTS "ProjectMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "supabaseUserId" TEXT NOT NULL,
  "role" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("supabaseUserId") REFERENCES "SupabaseUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_supabaseUserId_key" ON "ProjectMember"("projectId", "supabaseUserId");
CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectMember_supabaseUserId_idx" ON "ProjectMember"("supabaseUserId");

CREATE TABLE IF NOT EXISTS "KeywordGroupAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "keywordGroupId" TEXT NOT NULL,
  "supabaseUserId" TEXT NOT NULL,
  "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("keywordGroupId") REFERENCES "KeywordGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("supabaseUserId") REFERENCES "SupabaseUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "KeywordGroupAssignment_keywordGroupId_key" ON "KeywordGroupAssignment"("keywordGroupId");
CREATE INDEX IF NOT EXISTS "KeywordGroupAssignment_supabaseUserId_idx" ON "KeywordGroupAssignment"("supabaseUserId");

INSERT INTO "SupabaseUser" ("id", "email", "displayName", "createdAt", "updatedAt")
SELECT DISTINCT
  "assignedSupabaseUserId",
  "assignedSupabaseUserEmail",
  "assignedSupabaseUserName",
  COALESCE("assignedSupabaseAssignedAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "KeywordGroup"
WHERE "assignedSupabaseUserId" IS NOT NULL
  AND TRIM("assignedSupabaseUserId") <> ''
ON CONFLICT("id") DO UPDATE SET
  "email" = excluded."email",
  "displayName" = excluded."displayName",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "KeywordGroupAssignment" (
  "id",
  "keywordGroupId",
  "supabaseUserId",
  "assignedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'kga_' || "id",
  "id",
  "assignedSupabaseUserId",
  COALESCE("assignedSupabaseAssignedAt", CURRENT_TIMESTAMP),
  COALESCE("assignedSupabaseAssignedAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "KeywordGroup"
WHERE "assignedSupabaseUserId" IS NOT NULL
  AND TRIM("assignedSupabaseUserId") <> ''
ON CONFLICT("keywordGroupId") DO UPDATE SET
  "supabaseUserId" = excluded."supabaseUserId",
  "assignedAt" = excluded."assignedAt",
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "CompetitorAgencySite_projectId_idx" ON "CompetitorAgencySite"("projectId");
CREATE INDEX IF NOT EXISTS "Blog_projectId_idx" ON "Blog"("projectId");
CREATE INDEX IF NOT EXISTS "BlogArticle_projectId_idx" ON "BlogArticle"("projectId");
CREATE INDEX IF NOT EXISTS "Keyword_projectId_idx" ON "Keyword"("projectId");
CREATE INDEX IF NOT EXISTS "InternalLink_projectId_idx" ON "InternalLink"("projectId");
CREATE INDEX IF NOT EXISTS "Page_projectId_idx" ON "Page"("projectId");
CREATE INDEX IF NOT EXISTS "SeoCluster_projectId_idx" ON "SeoCluster"("projectId");
CREATE INDEX IF NOT EXISTS "KeywordGroup_projectId_idx" ON "KeywordGroup"("projectId");
CREATE INDEX IF NOT EXISTS "CustomerProblemCategory_projectId_idx" ON "CustomerProblemCategory"("projectId");
CREATE INDEX IF NOT EXISTS "CustomerProblem_projectId_idx" ON "CustomerProblem"("projectId");

PRAGMA foreign_keys=ON;
