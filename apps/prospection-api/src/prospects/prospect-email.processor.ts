import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DelayedError, Job } from 'bullmq';
import { PROSPECT_EMAIL_SEND_QUEUE } from 'src/queues/queue.constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { GmailMailService } from 'src/mail/gmail-mail.service';
import { ProspectEmailScheduleService } from './prospect-email-schedule.service';
import { recordProspectEmailSend } from './prospect-email-history';

export type ProspectEmailJobData = {
  prospectId: number;
  recipient: string;
  subject: string;
  body: string;
  text?: string;
  templateKey?: string;
};

@Injectable()
@Processor(PROSPECT_EMAIL_SEND_QUEUE, { concurrency: 1, lockDuration: 30000 })
export class ProspectEmailProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(ProspectEmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailMailService: GmailMailService,
    private readonly prospectEmailScheduleService: ProspectEmailScheduleService,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    this.logger.log(
      `Worker "${PROSPECT_EMAIL_SEND_QUEUE}" prêt, en attente de la fenêtre d'envoi.`,
    );
  }

  async cancelActiveJob(
    jobId: string,
    reason = 'Retiré manuellement de la file d’attente',
  ) {
    try {
      return await this.worker.cancelJob(jobId, reason);
    } catch {
      return false;
    }
  }

  async process(
    job: Job<ProspectEmailJobData>,
    token?: string,
    signal?: AbortSignal,
  ) {
    const { prospectId, recipient, subject, body, text } = job.data;
    const reservation =
      await this.prospectEmailScheduleService.reserveSendSlot();

    if (!reservation.reserved) {
      const nextAttemptAt =
        await this.prospectEmailScheduleService.getNextEligibleSendTimestamp();

      if (!token) {
        this.logger.warn(
          `Impossible de replanifier proprement l'email du prospect #${prospectId}: token BullMQ absent.`,
        );
        return { deferred: true, reason: 'missing_token' };
      }

      await job.moveToDelayed(nextAttemptAt.getTime(), token);
      this.logger.log(
        `Fenêtre fermée ou quota atteint, email du prospect #${prospectId} replanifié pour ${nextAttemptAt.toISOString()}.`,
      );
      throw new DelayedError();
    }

    if (signal?.aborted) {
      await this.prospectEmailScheduleService.releaseReservedSendSlot();
      return { cancelled: true };
    }

    try {
      const alreadySentRows = await this.prisma.$queryRawUnsafe<
        Array<{ first_contact_email_sent_at: string | null }>
      >(
        `
          SELECT "first_contact_email_sent_at"
          FROM "prospects"
          WHERE "id" = ? AND "trashed_at" IS NULL
          LIMIT 1
        `,
        prospectId,
      );

      if (alreadySentRows[0]?.first_contact_email_sent_at) {
        await this.prospectEmailScheduleService.releaseReservedSendSlot();
        this.logger.log(
          `Email déjà envoyé pour le prospect #${prospectId}, envoi ignoré.`,
        );
        return { skipped: true, reason: 'already_sent' };
      }

      const sendPromise = this.gmailMailService.sendEmail({
        to: recipient,
        subject,
        html: body,
        text,
        signal,
      });

      const cancellationPromise = signal
        ? new Promise<never>((_, reject) => {
            signal.addEventListener(
              'abort',
              () => {
                reject(
                  new Error(
                    `Cancelled: ${String(signal.reason || 'job cancelled')}`,
                  ),
                );
              },
              { once: true },
            );
          })
        : null;

      if (cancellationPromise) {
        await Promise.race([sendPromise, cancellationPromise]);
      } else {
        await sendPromise;
      }

      if (signal?.aborted) {
        await this.prospectEmailScheduleService.releaseReservedSendSlot();
        return { cancelled: true };
      }

      const sendRecord = await recordProspectEmailSend(this.prisma, {
        prospectId,
        recipientEmail: recipient,
      });

      await this.prisma.$executeRawUnsafe(
        `
          UPDATE "prospects"
          SET "first_contact_email_queued_at" = NULL,
              "first_contact_email_sent_at" = CURRENT_TIMESTAMP,
              "email_send_count" = ?,
              "status" = ?,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ? AND "trashed_at" IS NULL
        `,
        sendRecord.sendCount,
        sendRecord.sendCount > 1 ? 'Relance en cours' : 'Prospect contacté',
        prospectId,
      );

      void this.prospectEmailScheduleService
        .completeReservedSendSlot()
        .catch((error) => {
          this.logger.error(
            `Impossible de finaliser le créneau d’envoi pour le prospect #${prospectId}`,
            error instanceof Error ? error.stack : undefined,
          );
        });

      this.logger.log(`Email envoyé pour le prospect #${prospectId}.`);

      return { sent: true };
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof Error && /abort/i.test(error.message))
      ) {
        await this.prospectEmailScheduleService.releaseReservedSendSlot();
        return { cancelled: true };
      }

      await this.prospectEmailScheduleService.releaseReservedSendSlot();
      this.logger.error(
        `Erreur pendant l'envoi de l'email pour le prospect #${prospectId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
