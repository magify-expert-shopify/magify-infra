CREATE TABLE "BlogArticleScriptAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "blogArticleId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlogArticleScriptAsset_blogArticleId_fkey"
    FOREIGN KEY ("blogArticleId") REFERENCES "BlogArticle" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BlogArticleScriptAsset_blogArticleId_idx"
  ON "BlogArticleScriptAsset"("blogArticleId");

CREATE INDEX "BlogArticleScriptAsset_position_idx"
  ON "BlogArticleScriptAsset"("position");

CREATE UNIQUE INDEX "BlogArticleScriptAsset_blogArticleId_url_key"
  ON "BlogArticleScriptAsset"("blogArticleId", "url");
