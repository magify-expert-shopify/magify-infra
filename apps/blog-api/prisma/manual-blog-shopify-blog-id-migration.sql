ALTER TABLE "Blog"
  ADD COLUMN "shopifyBlogId" TEXT;

CREATE INDEX IF NOT EXISTS "Blog_shopifyBlogId_idx"
  ON "Blog"("shopifyBlogId");
