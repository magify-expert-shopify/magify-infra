import type {
  MaintenanceCsvExportPayload,
  MaintenanceCsvExportResponse,
  MaintenancePurgeResponse,
  MaintenanceSummaryResponse,
} from "~/types/maintenance";

export function useMaintenance() {
  const { request } = useApi();

  async function getMaintenanceSummary() {
    return await request<MaintenanceSummaryResponse>("/maintenance/summary");
  }

  async function purgeMaintenanceTarget(target: string) {
    return await request<MaintenancePurgeResponse>(`/maintenance/purge/${target}`, {
      method: "POST",
    });
  }

  async function purgeTrash() {
    return await request<MaintenancePurgeResponse>("/maintenance/purge-trash", {
      method: "POST",
    });
  }

  async function purgeMaintenanceTable(target: string) {
    return await request<MaintenancePurgeResponse>(`/maintenance/purge-table/${target}`, {
      method: "POST",
    });
  }

  async function unlinkKeywordGroupRelations() {
    return await request<MaintenancePurgeResponse>("/maintenance/unlink-group-relations", {
      method: "POST",
    });
  }

  async function exportMaintenanceCsv(payload: MaintenanceCsvExportPayload) {
    return await request<MaintenanceCsvExportResponse>("/maintenance/export", {
      method: "POST",
      body: payload,
    });
  }

  function useMaintenanceSummary() {
    return useAsyncData("maintenance-summary", getMaintenanceSummary);
  }

  return {
    getMaintenanceSummary,
    purgeMaintenanceTarget,
    purgeMaintenanceTable,
    unlinkKeywordGroupRelations,
    purgeTrash,
    exportMaintenanceCsv,
    useMaintenanceSummary,
  };
}
