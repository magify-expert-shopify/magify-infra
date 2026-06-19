const Database = require('better-sqlite3');

const db = new Database('dev.db');

db.pragma('foreign_keys = OFF');

const transaction = db.transaction(() => {
  db.exec(`
    ALTER TABLE "prospects" RENAME TO "prospects_old";

    CREATE TABLE "prospects" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "url_id" INTEGER,
      "name" TEXT NOT NULL,
      "site_name" TEXT,
      "source_url" TEXT NOT NULL,
      "source_file" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Prospect froid',
      "lead_score" INTEGER NOT NULL DEFAULT 0,
      "email" TEXT,
      "phone" TEXT,
      "linkedin_url" TEXT,
      "owner" TEXT,
      "last_checked" DATETIME,
      "evidence" TEXT,
      "score" INTEGER NOT NULL DEFAULT 0,
      "first_name" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL,
      "social_links_json" TEXT,
      "trashed_at" DATETIME,
      "linkedin_image_url" TEXT,
      "avatar_url" TEXT,
      "first_contact_email_sent_at" DATETIME,
      "first_contact_email_subject" TEXT,
      "first_contact_email_body" TEXT,
      "quote_file_name" TEXT,
      "quote_sent_at" DATETIME,
      "contract_file_name" TEXT,
      "contract_sent_at" DATETIME,
      "contract_signed_at" DATETIME,
      "first_contact_email_queued_at" DATETIME,
      "magify_ticket_id" TEXT,
      "magify_ticket_url" TEXT,
      CONSTRAINT "prospects_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    INSERT INTO "prospects" (
      "id",
      "url_id",
      "name",
      "site_name",
      "source_url",
      "source_file",
      "status",
      "lead_score",
      "email",
      "phone",
      "linkedin_url",
      "owner",
      "last_checked",
      "evidence",
      "score",
      "first_name",
      "created_at",
      "updated_at",
      "social_links_json",
      "trashed_at",
      "linkedin_image_url",
      "avatar_url",
      "first_contact_email_sent_at",
      "first_contact_email_subject",
      "first_contact_email_body",
      "quote_file_name",
      "quote_sent_at",
      "contract_file_name",
      "contract_sent_at",
      "contract_signed_at",
      "first_contact_email_queued_at",
      "magify_ticket_id",
      "magify_ticket_url"
    )
    SELECT
      "id",
      "url_id",
      "name",
      "site_name",
      "source_url",
      "source_file",
      "status",
      "lead_score",
      "email",
      "phone",
      "linkedin_url",
      "owner",
      "last_checked",
      "evidence",
      "score",
      "first_name",
      "created_at",
      "updated_at",
      "social_links_json",
      "trashed_at",
      "linkedin_image_url",
      "avatar_url",
      "first_contact_email_sent_at",
      "first_contact_email_subject",
      "first_contact_email_body",
      "quote_file_name",
      "quote_sent_at",
      "contract_file_name",
      "contract_sent_at",
      "contract_signed_at",
      "first_contact_email_queued_at",
      "magify_ticket_id",
      "magify_ticket_url"
    FROM "prospects_old";

    DROP TABLE "prospects_old";

    CREATE INDEX "prospects_source_file_idx" ON "prospects"("source_file");
    CREATE INDEX "prospects_status_idx" ON "prospects"("status");
    CREATE UNIQUE INDEX "prospects_url_id_key" ON "prospects"("url_id");
  `);
});

transaction();
db.pragma('foreign_keys = ON');

console.log('prospects.site_name is now nullable in dev.db');
