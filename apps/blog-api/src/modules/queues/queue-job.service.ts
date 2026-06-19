import type { Job, Queue } from 'bullmq';

export class QueueJobService {
  protected async enqueueUniqueJob<T extends object>(
    queue: Queue<T>,
    jobName: string,
    data: T,
    jobId: string,
  ) {
    const existingJob = await queue.getJob(jobId);

    if (existingJob) {
      const state = await existingJob.getState();

      if (this.isQueuedState(state)) {
        return this.serializeJob(existingJob);
      }

      await existingJob.remove();
    }

    const job = await (queue as any).add(jobName, data, {
      jobId,
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    return this.serializeJob(job);
  }

  protected serializeJob<T>(job: Job<T>) {
    return {
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      data: job.data,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }

  protected isQueuedState(state: string) {
    return ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'].includes(
      state,
    );
  }
}
