import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SiteSettingsService, type EmailSendingSetting } from 'src/site-settings/site-settings.service';
import { getTableColumnNames } from 'src/database/sqlite-schema';

const EMAIL_SENDING_STATS_TABLE = 'prospect_email_sending_stats';
const PARIS_TIME_ZONE = 'Europe/Paris';

export type ProspectEmailScheduleStatus = {
  settings: EmailSendingSetting;
  todaySent: number;
  todayReserved: number;
  remainingToday: number;
  isBusinessDay: boolean;
  isAfterScheduleHour: boolean;
  isBeforeSendUntilHour: boolean;
  hasReachedSendUntilHour: boolean;
  canSendNow: boolean;
  todayKey: string;
};

@Injectable()
export class ProspectEmailScheduleService implements OnModuleInit {
  private tableReady = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    if (this.tableReady) {
      return;
    }

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${EMAIL_SENDING_STATS_TABLE}" (
        "sending_date" TEXT PRIMARY KEY NOT NULL,
        "sent_count" INTEGER NOT NULL DEFAULT 0,
        "reserved_count" INTEGER NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const columns = await getTableColumnNames(this.prisma, EMAIL_SENDING_STATS_TABLE);

    if (!columns.includes('reserved_count')) {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "${EMAIL_SENDING_STATS_TABLE}" ADD COLUMN "reserved_count" INTEGER NOT NULL DEFAULT 0`,
      );
    }

    this.tableReady = true;
  }

  private escapeSqlLiteral(value: string) {
    return value.replace(/'/g, "''");
  }

  private async readStatsRow(sendingDate: string) {
    const safeDate = this.escapeSqlLiteral(sendingDate);
    const rows = await this.prisma.$queryRawUnsafe<Array<{ sent_count: number; reserved_count: number }>>(
      `SELECT "sent_count", "reserved_count"
       FROM "${EMAIL_SENDING_STATS_TABLE}"
       WHERE "sending_date" = '${safeDate}'
       LIMIT 1`,
    );

    return rows[0] || { sent_count: 0, reserved_count: 0 };
  }

  private getParisParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: PARIS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
    const weekday = get('weekday');
    const weekdayIndex = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekday] ?? 0;

    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      hour: Number(get('hour')),
      minute: Number(get('minute')),
      weekdayIndex,
    };
  }

  private formatDateKey(year: number, month: number, day: number) {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private getParisTimeZoneOffsetMinutes(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: PARIS_TIME_ZONE,
      timeZoneName: 'shortOffset',
    });
    const timeZoneName = formatter
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value || 'GMT+0';
    const match = timeZoneName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);

    if (!match) {
      return 0;
    }

    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);

    return sign * (hours * 60 + minutes);
  }

  getTodaySendTimestampAtHour(sendAtHour: number, date = new Date()) {
    const parts = this.getParisParts(date);
    const normalizedHour = Math.min(23, Math.max(0, Math.floor(Number(sendAtHour) || 0)));
    const offsetMinutes = this.getParisTimeZoneOffsetMinutes(date);

    return new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day, normalizedHour, 0, 0) -
        offsetMinutes * 60_000,
    );
  }

  async getNextEligibleSendTimestamp(date = new Date()) {
    const settings = await this.siteSettingsService.getEmailSending();
    const current = new Date(date.getTime());
    const todaySendAt = this.getTodaySendTimestampAtHour(settings.sendAtHour, current);

    if (this.isBusinessDay(current) && current.getTime() < todaySendAt.getTime()) {
      return todaySendAt;
    }

    let candidate = new Date(todaySendAt.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + 1);

    while (!this.isBusinessDay(candidate)) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }

    return this.getTodaySendTimestampAtHour(settings.sendAtHour, candidate);
  }

  private getEasterSunday(year: number) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  }

  private getFrenchPublicHolidays(year: number) {
    const easter = this.getEasterSunday(year);
    const easterSunday = new Date(Date.UTC(year, easter.month - 1, easter.day));
    const addDays = (days: number) => {
      const date = new Date(easterSunday.getTime());
      date.setUTCDate(date.getUTCDate() + days);
      return this.formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    };

    return new Set<string>([
      this.formatDateKey(year, 1, 1),
      addDays(1),
      this.formatDateKey(year, 5, 1),
      this.formatDateKey(year, 5, 8),
      addDays(39),
      addDays(50),
      this.formatDateKey(year, 7, 14),
      this.formatDateKey(year, 8, 15),
      this.formatDateKey(year, 11, 1),
      this.formatDateKey(year, 11, 11),
      this.formatDateKey(year, 12, 25),
    ]);
  }

  private isBusinessDay(date = new Date()) {
    const parts = this.getParisParts(date);
    if (parts.weekdayIndex === 0 || parts.weekdayIndex === 6) {
      return false;
    }

    return !this.getFrenchPublicHolidays(parts.year).has(this.formatDateKey(parts.year, parts.month, parts.day));
  }

  async getStatus(): Promise<ProspectEmailScheduleStatus> {
    await this.ensureTable();

    const settings = await this.siteSettingsService.getEmailSending();
    const now = this.getParisParts();
    const todayKey = this.formatDateKey(now.year, now.month, now.day);

    const row = await this.readStatsRow(todayKey);
    const todaySent = Number(row.sent_count || 0);
    const todayReserved = Number(row.reserved_count || 0);
    const todayUsed = todaySent + todayReserved;
    const isBusinessDay = this.isBusinessDay();
    const isAfterScheduleHour = now.hour >= settings.sendAtHour;
    const hasReachedSendUntilHour = now.hour >= settings.sendUntilHour;
    const isBeforeSendUntilHour = !hasReachedSendUntilHour;
    const canSendNow =
      !settings.paused
      && isBusinessDay
      && isAfterScheduleHour
      && isBeforeSendUntilHour
      && todayUsed < settings.dailyLimit;

    return {
      settings,
      todaySent,
      todayReserved,
      remainingToday: Math.max(0, settings.dailyLimit - todayUsed),
      isBusinessDay,
      isAfterScheduleHour,
      isBeforeSendUntilHour,
      hasReachedSendUntilHour,
      canSendNow,
      todayKey,
    };
  }

  async reserveSendSlot() {
    await this.ensureTable();

    const now = this.getParisParts();
    const todayKey = this.formatDateKey(now.year, now.month, now.day);
    const status = await this.getStatus();

    if (
      status.settings.paused
      || !status.isBusinessDay
      || !status.isAfterScheduleHour
      || !status.isBeforeSendUntilHour
    ) {
      return { reserved: false, status };
    }

    if (status.todaySent + status.todayReserved >= status.settings.dailyLimit) {
      return { reserved: false, status };
    }

    const safeDate = this.escapeSqlLiteral(todayKey);
    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "${EMAIL_SENDING_STATS_TABLE}" ("sending_date", "sent_count", "reserved_count", "updated_at")
        VALUES ('${safeDate}', 0, 1, CURRENT_TIMESTAMP)
        ON CONFLICT ("sending_date") DO UPDATE SET
          "reserved_count" = "reserved_count" + 1,
          "updated_at" = CURRENT_TIMESTAMP
      `,
    );

    return { reserved: true, status: await this.getStatus() };
  }

  async completeReservedSendSlot() {
    await this.ensureTable();

    const now = this.getParisParts();
    const todayKey = this.formatDateKey(now.year, now.month, now.day);

    const safeDate = this.escapeSqlLiteral(todayKey);
    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "${EMAIL_SENDING_STATS_TABLE}" ("sending_date", "sent_count", "reserved_count", "updated_at")
        VALUES ('${safeDate}', 1, 0, CURRENT_TIMESTAMP)
        ON CONFLICT ("sending_date") DO UPDATE SET
          "sent_count" = "sent_count" + 1,
          "reserved_count" = CASE WHEN "reserved_count" > 0 THEN "reserved_count" - 1 ELSE 0 END,
          "updated_at" = CURRENT_TIMESTAMP
      `,
    );

    return this.getStatus();
  }

  async releaseReservedSendSlot() {
    await this.ensureTable();

    const now = this.getParisParts();
    const todayKey = this.formatDateKey(now.year, now.month, now.day);

    const safeDate = this.escapeSqlLiteral(todayKey);
    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "${EMAIL_SENDING_STATS_TABLE}" ("sending_date", "sent_count", "reserved_count", "updated_at")
        VALUES ('${safeDate}', 0, 0, CURRENT_TIMESTAMP)
        ON CONFLICT ("sending_date") DO UPDATE SET
          "reserved_count" = CASE WHEN "reserved_count" > 0 THEN "reserved_count" - 1 ELSE 0 END,
          "updated_at" = CURRENT_TIMESTAMP
      `,
    );

    return this.getStatus();
  }
}
