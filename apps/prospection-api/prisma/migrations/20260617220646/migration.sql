-- CreateTable
CREATE TABLE "urls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "source_file" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopify_status" TEXT NOT NULL DEFAULT 'unknown',
    "site_key" TEXT,
    "site_country_code" TEXT,
    "site_country_name" TEXT,
    "site_language_code" TEXT,
    "site_language_name" TEXT,
    "shopify_checked_at" DATETIME,
    "http_status" INTEGER,
    "shopify_evidence" TEXT,
    "cms_name" TEXT,
    "cms_evidence" TEXT,
    "shopify_theme_name" TEXT,
    "shopify_theme_id" TEXT,
    "shopify_theme_schema_name" TEXT,
    "shopify_theme_json" TEXT,
    "shopify_theme_store_type" TEXT,
    "redesign_status" TEXT,
    "redesign_decision" TEXT,
    "scan_shopify_ms" INTEGER,
    "scan_catalog_ms" INTEGER,
    "scan_contact_ms" INTEGER,
    "scan_cms_detection_ms" INTEGER,
    "scan_language_ms" INTEGER,
    "scan_seo_meta_ms" INTEGER,
    "scan_legal_notice_ms" INTEGER,
    "scan_linkedin_ms" INTEGER,
    "scan_social_ms" INTEGER,
    "scan_technical_ms" INTEGER,
    "scan_lighthouse_ms" INTEGER,
    "scan_workflow_total_ms" INTEGER,
    "scan_ttfb_ms" INTEGER,
    "scan_total_ms" INTEGER,
    "scan_html_bytes" INTEGER,
    "lighthouse_checked_at" DATETIME,
    "lighthouse_score" INTEGER,
    "lighthouse_performance_score" INTEGER,
    "lighthouse_accessibility_score" INTEGER,
    "lighthouse_best_practices_score" INTEGER,
    "lighthouse_seo_score" INTEGER,
    "lighthouse_observations_json" TEXT,
    "lighthouse_report_json" TEXT,
    "rescan_requested_at" DATETIME,
    "shopify_legal_notice_status" TEXT,
    "shopify_legal_notice_url" TEXT,
    "shopify_legal_notice_checked_at" DATETIME,
    "seo_meta_checked_at" DATETIME,
    "site_name" TEXT,
    "trashed_at" DATETIME,
    "blacklisted_at" DATETIME
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url_id" INTEGER,
    "name" TEXT,
    "site_name" TEXT,
    "source_url" TEXT NOT NULL,
    "source_file" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Prospect froid',
    "lead_score" INTEGER NOT NULL DEFAULT 0,
    "email" TEXT,
    "email_send_count" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "linkedin_url" TEXT,
    "owner" TEXT,
    "last_name" TEXT,
    "siret" TEXT,
    "siren" TEXT,
    "company_name" TEXT,
    "company_address" TEXT,
    "company_address_extra" TEXT,
    "company_postal_code" TEXT,
    "company_city" TEXT,
    "company_legal_form" TEXT,
    "company_country" TEXT,
    "company_linkedin_url" TEXT,
    "last_checked" DATETIME,
    "evidence" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "first_name" TEXT,
    "social_links_json" TEXT,
    "contact_status" TEXT NOT NULL DEFAULT 'unknown',
    "contact_checked_at" DATETIME,
    "first_contact_email_queued_at" DATETIME,
    "first_contact_email_sent_at" DATETIME,
    "first_contact_email_subject" TEXT,
    "first_contact_email_body" TEXT,
    "quote_file_name" TEXT,
    "quote_sent_at" DATETIME,
    "contract_file_name" TEXT,
    "contract_sent_at" DATETIME,
    "contract_signed_at" DATETIME,
    "trashed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "prospects_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "imports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source_file" TEXT NOT NULL,
    "urls_json" TEXT NOT NULL,
    "url_ids_json" TEXT NOT NULL,
    "total_urls" INTEGER NOT NULL DEFAULT 0,
    "existing_urls" INTEGER NOT NULL DEFAULT 0,
    "queued_urls" INTEGER NOT NULL DEFAULT 0,
    "processed_urls" INTEGER NOT NULL DEFAULT 0,
    "failed_urls" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'created',
    "current_step" TEXT NOT NULL DEFAULT 'created',
    "queued_at" DATETIME,
    "started_at" DATETIME,
    "finished_at" DATETIME,
    "last_error" TEXT,
    "shopify_done_at" DATETIME,
    "contact_done_at" DATETIME,
    "linkedin_done_at" DATETIME,
    "technical_done_at" DATETIME,
    "lighthouse_done_at" DATETIME,
    "completed_at" DATETIME,
    "trashed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "urls_url_key" ON "urls"("url");

-- CreateIndex
CREATE INDEX "urls_source_file_idx" ON "urls"("source_file");

-- CreateIndex
CREATE INDEX "urls_site_key_idx" ON "urls"("site_key");

-- CreateIndex
CREATE INDEX "urls_created_at_idx" ON "urls"("created_at");

-- CreateIndex
CREATE INDEX "urls_shopify_status_idx" ON "urls"("shopify_status");

-- CreateIndex
CREATE INDEX "urls_shopify_checked_at_idx" ON "urls"("shopify_checked_at");

-- CreateIndex
CREATE INDEX "urls_site_name_idx" ON "urls"("site_name");

-- CreateIndex
CREATE INDEX "urls_trashed_at_idx" ON "urls"("trashed_at");

-- CreateIndex
CREATE INDEX "urls_blacklisted_at_idx" ON "urls"("blacklisted_at");

-- CreateIndex
CREATE INDEX "urls_trashed_at_blacklisted_at_created_at_idx" ON "urls"("trashed_at", "blacklisted_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_url_id_key" ON "prospects"("url_id");

-- CreateIndex
CREATE INDEX "prospects_status_idx" ON "prospects"("status");

-- CreateIndex
CREATE INDEX "prospects_source_file_idx" ON "prospects"("source_file");

-- CreateIndex
CREATE INDEX "prospects_trashed_at_idx" ON "prospects"("trashed_at");

-- CreateIndex
CREATE INDEX "imports_status_idx" ON "imports"("status");

-- CreateIndex
CREATE INDEX "imports_created_at_idx" ON "imports"("created_at");

-- CreateIndex
CREATE INDEX "imports_trashed_at_created_at_idx" ON "imports"("trashed_at", "created_at");

-- CreateIndex
CREATE INDEX "imports_trashed_at_status_created_at_idx" ON "imports"("trashed_at", "status", "created_at");
