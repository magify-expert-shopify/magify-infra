CREATE TABLE IF NOT EXISTS "KeywordSiteVisibilityObservation" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_sourceCacheKey_pageUrl_key"
  ON "KeywordSiteVisibilityObservation"("sourceCacheKey", "pageUrl");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_projectId_idx"
  ON "KeywordSiteVisibilityObservation"("projectId");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_keywordId_idx"
  ON "KeywordSiteVisibilityObservation"("keywordId");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_keywordText_idx"
  ON "KeywordSiteVisibilityObservation"("keywordText");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_pageId_idx"
  ON "KeywordSiteVisibilityObservation"("pageId");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_siteBaseUrl_idx"
  ON "KeywordSiteVisibilityObservation"("siteBaseUrl");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_siteHostname_idx"
  ON "KeywordSiteVisibilityObservation"("siteHostname");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_position_idx"
  ON "KeywordSiteVisibilityObservation"("position");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_observedAt_idx"
  ON "KeywordSiteVisibilityObservation"("observedAt");

CREATE INDEX IF NOT EXISTS "KeywordSiteVisibilityObservation_sourceCacheCreatedAt_idx"
  ON "KeywordSiteVisibilityObservation"("sourceCacheCreatedAt");
