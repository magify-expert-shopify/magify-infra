import { PrismaService } from 'src/prisma/prisma.service';
import { ensureProspectsTable, getTableColumnNames } from 'src/database/sqlite-schema';

const PROSPECT_EMAIL_SEND_HISTORY_TABLE = 'prospect_email_send_history';
const PARIS_TIME_ZONE = 'Europe/Paris';
const PROSPECTS_TABLE = 'prospects';

function getParisDayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TIME_ZONE,
    weekday: 'long',
  })
    .format(date)
    .trim();
}

async function ensureProspectEmailSendCountColumn(prisma: PrismaService) {
  await ensureProspectsTable(prisma);

  const columns = await getTableColumnNames(prisma, PROSPECTS_TABLE);

  if (!columns.includes('email_send_count')) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${PROSPECTS_TABLE}" ADD COLUMN "email_send_count" INTEGER NOT NULL DEFAULT 0`,
    );
  }
}

export async function ensureProspectEmailSendHistoryTable(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${PROSPECT_EMAIL_SEND_HISTORY_TABLE}" (
      "id" SERIAL PRIMARY KEY,
      "prospect_id" INTEGER NOT NULL,
      "recipient_email" TEXT NOT NULL,
      "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "sent_day" TEXT NOT NULL,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = await getTableColumnNames(prisma, PROSPECT_EMAIL_SEND_HISTORY_TABLE);

  if (!columns.includes('updated_at')) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${PROSPECT_EMAIL_SEND_HISTORY_TABLE}" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
  }
}

export async function recordProspectEmailSend(prisma: PrismaService, payload: {
  prospectId: number;
  recipientEmail: string;
  sentAt?: Date;
}) {
  await ensureProspectEmailSendHistoryTable(prisma);
  await ensureProspectEmailSendCountColumn(prisma);

  const sentAt = payload.sentAt ?? new Date();
  const sentAtIso = sentAt.toISOString();
  const sentDay = getParisDayLabel(sentAt);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "${PROSPECT_EMAIL_SEND_HISTORY_TABLE}" (
        "prospect_id",
        "recipient_email",
        "sent_at",
        "sent_day",
        "updated_at"
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    payload.prospectId,
    payload.recipientEmail,
    sentAtIso,
    sentDay,
  );

  await prisma.$executeRawUnsafe(
    `
      UPDATE "prospects"
      SET
        "email_send_count" = COALESCE("email_send_count", 0) + 1,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ? AND "trashed_at" IS NULL
    `,
    payload.prospectId,
  );

  const rows = await prisma.$queryRawUnsafe<Array<{ email_send_count: number }>>(
    `
      SELECT "email_send_count"
      FROM "prospects"
      WHERE "id" = ? AND "trashed_at" IS NULL
      LIMIT 1
    `,
    payload.prospectId,
  );

  return {
    sentAt,
    sentDay,
    sendCount: Number(rows[0]?.email_send_count || 0),
  };
}

