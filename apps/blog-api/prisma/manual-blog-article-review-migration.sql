ALTER TABLE "BlogArticle"
  ADD COLUMN "reviewSupabaseUserId" TEXT;

ALTER TABLE "BlogArticle"
  ADD COLUMN "reviewAssignedAt" DATETIME;

ALTER TABLE "BlogArticle"
  ADD COLUMN "reviewDueAt" DATETIME;

ALTER TABLE "BlogArticle"
  ADD COLUMN "reviewCompletedAt" DATETIME;

ALTER TABLE "BlogArticle"
  ADD COLUMN "reviewOutcome" TEXT;

ALTER TABLE "BlogArticle"
  ADD COLUMN "reviewComment" TEXT;

CREATE INDEX IF NOT EXISTS "BlogArticle_reviewSupabaseUserId_idx"
  ON "BlogArticle"("reviewSupabaseUserId");

CREATE INDEX IF NOT EXISTS "BlogArticle_reviewDueAt_idx"
  ON "BlogArticle"("reviewDueAt");
