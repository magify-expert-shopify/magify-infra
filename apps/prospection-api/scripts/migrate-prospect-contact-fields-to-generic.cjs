const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'dev.db');
const db = new Database(dbPath);

const genericColumns = [
  ['last_name', 'TEXT'],
  ['siret', 'TEXT'],
  ['siren', 'TEXT'],
  ['company_name', 'TEXT'],
  ['company_address', 'TEXT'],
  ['company_address_extra', 'TEXT'],
  ['company_postal_code', 'TEXT'],
  ['company_city', 'TEXT'],
  ['company_legal_form', 'TEXT'],
  ['company_country', 'TEXT'],
  ['company_linkedin_url', 'TEXT'],
];

const legacyColumns = [
  ['contact_last_name', 'last_name'],
  ['contact_siret', 'siret'],
  ['contact_siren', 'siren'],
  ['contact_company_name', 'company_name'],
  ['contact_company_address', 'company_address'],
  ['contact_company_address_extra', 'company_address_extra'],
  ['contact_company_postal_code', 'company_postal_code'],
  ['contact_company_city', 'company_city'],
  ['contact_company_legal_form', 'company_legal_form'],
  ['contact_company_country', 'company_country'],
  ['contact_company_linkedin_url', 'company_linkedin_url'],
];

const columnsToDrop = [
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

function addMissingGenericColumns() {
  const existing = new Set(getColumns('prospects'));

  for (const [name, definition] of genericColumns) {
    if (!existing.has(name)) {
      db.prepare(`ALTER TABLE "prospects" ADD COLUMN "${name}" ${definition}`).run();
    }
  }
}

function copyLegacyValues() {
  const assignments = legacyColumns
    .map(([legacy, generic]) => `"${generic}" = COALESCE(NULLIF("${generic}", ''), "${legacy}")`)
    .join(',\n      ');

  db.prepare(`
    UPDATE "prospects"
    SET
      ${assignments}
  `).run();
}

function dropLegacyColumns() {
  const existing = new Set(getColumns('prospects'));

  for (const column of columnsToDrop) {
    if (existing.has(column)) {
      db.prepare(`ALTER TABLE "prospects" DROP COLUMN "${column}"`).run();
    }
  }
}

db.pragma('foreign_keys = OFF');
db.transaction(() => {
  addMissingGenericColumns();
  copyLegacyValues();
  dropLegacyColumns();
})();
db.pragma('foreign_keys = ON');

console.log('Migrated prospect contact fields to generic columns in dev.db');
