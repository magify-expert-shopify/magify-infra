export type CurrentSprintResponse = {
  clusterId: string | null;
  clusterName: string | null;
  blogArticleTargetCount: number;
  startDate: string;
  durationDays: number | null;
  endDate: string;
  isInProgress: boolean;
};

export type SprintClusterSettings = {
  clusterId: string | null;
  clusterName: string | null;
};
