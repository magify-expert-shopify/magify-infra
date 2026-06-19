export type QueueDashboardJob = {
  id: string | number | undefined;
  name: string;
  data: Record<string, unknown>;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  delay: number;
};

export type QueueDashboardQueue = {
  name: string;
  label: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  jobs: QueueDashboardJob[];
};

export type QueueDashboardResponse = {
  generatedAt: string;
  queues: QueueDashboardQueue[];
};

export type StatsCountsResponse = {
  agencySites: number;
  blogs: number;
  blogArticles: number;
  authors: number;
};
