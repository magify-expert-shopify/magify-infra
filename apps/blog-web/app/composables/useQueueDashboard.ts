import type {
  QueueDashboardResponse,
  StatsCountsResponse,
} from "~/types/queue-dashboard";
import type { StatsCurrentGoalResponse } from "~/types/stats-goal";

const QUEUE_DASHBOARD_ASYNC_KEY = "queue-dashboard";
const STATS_COUNTS_ASYNC_KEY = "stats-counts";
const STATS_CURRENT_GOAL_ASYNC_KEY = "stats-current-goal";

export function useQueueDashboard() {
  const { request } = useApi();

  function useQueueDashboardData() {
    return useAsyncData(QUEUE_DASHBOARD_ASYNC_KEY, () =>
      request<QueueDashboardResponse>("/stats/queues"),
    );
  }

  function useStatsCountsData() {
    return useAsyncData(STATS_COUNTS_ASYNC_KEY, () =>
      request<StatsCountsResponse>("/stats/counts"),
    );
  }

  function useCurrentGoalData() {
    return useAsyncData(STATS_CURRENT_GOAL_ASYNC_KEY, () =>
      request<StatsCurrentGoalResponse>("/stats/current-goal"),
    );
  }

  return {
    useCurrentGoalData,
    useQueueDashboardData,
    useStatsCountsData,
  };
}
