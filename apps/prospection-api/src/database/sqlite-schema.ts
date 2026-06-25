import { PrismaService } from 'src/prisma/prisma.service';

const URLS_TABLE = 'urls';
const PROSPECTS_TABLE = 'prospects';

export async function ensureUrlsTable(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${URLS_TABLE}" (
      "id" SERIAL PRIMARY KEY,
      "url" TEXT NOT NULL UNIQUE,
      "source_file" TEXT NOT NULL,
      "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "shopify_status" TEXT NOT NULL DEFAULT 'unknown',
      "site_key" TEXT,
      "site_country_code" TEXT,
      "site_country_name" TEXT,
      "site_language_code" TEXT,
      "site_language_name" TEXT,
      "shopify_checked_at" TIMESTAMP(6),
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
      "lighthouse_checked_at" TIMESTAMP(6),
      "lighthouse_score" INTEGER,
      "lighthouse_performance_score" INTEGER,
      "lighthouse_accessibility_score" INTEGER,
      "lighthouse_best_practices_score" INTEGER,
      "lighthouse_seo_score" INTEGER,
      "lighthouse_observations_json" TEXT,
      "lighthouse_report_json" TEXT,
      "rescan_requested_at" TIMESTAMP(6),
      "shopify_legal_notice_status" TEXT,
      "shopify_legal_notice_url" TEXT,
      "shopify_legal_notice_checked_at" TIMESTAMP(6),
      "seo_meta_checked_at" TIMESTAMP(6),
      "site_name" TEXT,
      "trashed_at" TIMESTAMP(6),
      "blacklisted_at" TIMESTAMP(6)
    )
  `);
}

export async function ensureProspectsTable(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${PROSPECTS_TABLE}" (
      "id" SERIAL PRIMARY KEY,
      "url_id" INTEGER UNIQUE,
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
      "last_checked" TIMESTAMP(6),
      "evidence" TEXT,
      "score" INTEGER NOT NULL DEFAULT 0,
      "first_name" TEXT,
      "social_links_json" TEXT,
      "contact_status" TEXT NOT NULL DEFAULT 'unknown',
      "contact_checked_at" TIMESTAMP(6),
      "first_contact_email_queued_at" TIMESTAMP(6),
      "first_contact_email_sent_at" TIMESTAMP(6),
      "first_contact_email_subject" TEXT,
      "first_contact_email_body" TEXT,
      "quote_file_name" TEXT,
      "quote_sent_at" TIMESTAMP(6),
      "contract_file_name" TEXT,
      "contract_sent_at" TIMESTAMP(6),
      "contract_signed_at" TIMESTAMP(6),
      "trashed_at" TIMESTAMP(6),
      "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getTableColumnNames(prisma: PrismaService, tableName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT COLUMN_NAME AS name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = current_schema()
       AND TABLE_NAME = '${tableName}'`,
  );

  return rows.map((row) => row.name);
}

