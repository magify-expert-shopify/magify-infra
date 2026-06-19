const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'dev.db');
const db = new Database(dbPath);

const urlContactColumns = [
  'contact_status',
  'contact_checked_at',
  'contact_email',
  'contact_phone',
  'contact_siret',
  'contact_siren',
  'contact_first_name',
  'contact_last_name',
  'contact_owner_name',
  'contact_company_name',
  'contact_company_address',
  'contact_company_address_extra',
  'contact_company_postal_code',
  'contact_company_city',
  'contact_company_legal_form',
  'contact_company_country',
  'contact_source_url',
  'contact_evidence',
  'contact_linkedin_url',
  'contact_company_linkedin_url',
  'contact_social_links_json',
];

const prospectContactColumns = [
  'contact_status',
  'contact_checked_at',
  'contact_email',
  'contact_phone',
  'contact_siret',
  'contact_siren',
  'contact_first_name',
  'contact_last_name',
  'contact_owner_name',
  'contact_company_name',
  'contact_company_address',
  'contact_company_address_extra',
  'contact_company_postal_code',
  'contact_company_city',
  'contact_company_legal_form',
  'contact_company_country',
  'contact_source_url',
  'contact_evidence',
  'contact_linkedin_url',
  'contact_company_linkedin_url',
  'contact_social_links_json',
];

function getColumns(tableName) {
  return db.prepare(`PRAGMA table_info("${tableName}")`).all().map((row) => row.name);
}

function addMissingProspectColumns() {
  const columns = new Set(getColumns('prospects'));
  const statements = [];

  const definitions = [
    ['contact_status', 'TEXT NOT NULL DEFAULT \'unknown\''],
    ['contact_checked_at', 'DATETIME'],
    ['contact_email', 'TEXT'],
    ['contact_phone', 'TEXT'],
    ['contact_siret', 'TEXT'],
    ['contact_siren', 'TEXT'],
    ['contact_first_name', 'TEXT'],
    ['contact_last_name', 'TEXT'],
    ['contact_owner_name', 'TEXT'],
    ['contact_company_name', 'TEXT'],
    ['contact_company_address', 'TEXT'],
    ['contact_company_address_extra', 'TEXT'],
    ['contact_company_postal_code', 'TEXT'],
    ['contact_company_city', 'TEXT'],
    ['contact_company_legal_form', 'TEXT'],
    ['contact_company_country', 'TEXT'],
    ['contact_source_url', 'TEXT'],
    ['contact_evidence', 'TEXT'],
    ['contact_linkedin_url', 'TEXT'],
    ['contact_company_linkedin_url', 'TEXT'],
    ['contact_social_links_json', 'TEXT'],
  ];

  for (const [name, definition] of definitions) {
    if (!columns.has(name)) {
      statements.push(`ALTER TABLE "prospects" ADD COLUMN "${name}" ${definition}`);
    }
  }

  for (const statement of statements) {
    db.prepare(statement).run();
  }
}

function copyContactDataToProspects() {
  db.prepare(`
    UPDATE "prospects"
    SET
      "contact_status" = COALESCE((SELECT "contact_status" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_status"),
      "contact_checked_at" = COALESCE((SELECT "contact_checked_at" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_checked_at"),
      "contact_email" = COALESCE((SELECT "contact_email" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_email"),
      "contact_phone" = COALESCE((SELECT "contact_phone" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_phone"),
      "contact_siret" = COALESCE((SELECT "contact_siret" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_siret"),
      "contact_siren" = COALESCE((SELECT "contact_siren" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_siren"),
      "contact_first_name" = COALESCE((SELECT "contact_first_name" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_first_name"),
      "contact_last_name" = COALESCE((SELECT "contact_last_name" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_last_name"),
      "contact_owner_name" = COALESCE((SELECT "contact_owner_name" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_owner_name"),
      "contact_company_name" = COALESCE((SELECT "contact_company_name" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_name"),
      "contact_company_address" = COALESCE((SELECT "contact_company_address" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_address"),
      "contact_company_address_extra" = COALESCE((SELECT "contact_company_address_extra" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_address_extra"),
      "contact_company_postal_code" = COALESCE((SELECT "contact_company_postal_code" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_postal_code"),
      "contact_company_city" = COALESCE((SELECT "contact_company_city" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_city"),
      "contact_company_legal_form" = COALESCE((SELECT "contact_company_legal_form" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_legal_form"),
      "contact_company_country" = COALESCE((SELECT "contact_company_country" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_country"),
      "contact_source_url" = COALESCE((SELECT "contact_source_url" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_source_url"),
      "contact_evidence" = COALESCE((SELECT "contact_evidence" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_evidence"),
      "contact_linkedin_url" = COALESCE((SELECT "contact_linkedin_url" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_linkedin_url"),
      "contact_company_linkedin_url" = COALESCE((SELECT "contact_company_linkedin_url" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_company_linkedin_url"),
      "contact_social_links_json" = COALESCE((SELECT "contact_social_links_json" FROM "urls" WHERE "urls"."id" = "prospects"."url_id"), "contact_social_links_json")
    WHERE EXISTS (SELECT 1 FROM "urls" WHERE "urls"."id" = "prospects"."url_id")
  `).run();
}

function dropUrlContactColumns() {
  const contactIndexes = db
    .prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'urls' AND sql IS NOT NULL`)
    .all()
    .filter((row) => {
      const sql = String(row.sql || '').toLowerCase();
      const name = String(row.name || '').toLowerCase();
      return name.includes('contact') || sql.includes('contact_');
    });

  for (const index of contactIndexes) {
    db.prepare(`DROP INDEX IF EXISTS "${index.name}"`).run();
  }

  const columns = new Set(getColumns('urls'));
  for (const column of urlContactColumns) {
    if (columns.has(column)) {
      db.prepare(`ALTER TABLE "urls" DROP COLUMN "${column}"`).run();
    }
  }
}

db.pragma('foreign_keys = OFF');
db.transaction(() => {
  addMissingProspectColumns();
  copyContactDataToProspects();
  dropUrlContactColumns();
})();
db.pragma('foreign_keys = ON');

console.log('Moved contact fields from urls to prospects in dev.db');
