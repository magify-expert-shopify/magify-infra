export type MaintenanceAction =
  | "purge-trash"
  | "clear-cache"
  | "clear-keyword-templates"
  | "unlink-group-relations"
  | "none";

export type MaintenanceSummaryItem = {
  key: string;
  label: string;
  totalCount: number;
  trashedCount: number | null;
  tablePurgeable: boolean;
  action: MaintenanceAction;
};

export type MaintenanceSummaryResponse = {
  items: MaintenanceSummaryItem[];
};

export type MaintenancePurgeResponse = {
  target: string;
  deletedCount: number;
};

export type MaintenanceCsvImportPayload = {
  file: File;
  targets: string[];
};

export type MaintenanceCsvExportPayload = {
  targets: string[];
};

export type MaintenanceCsvExportFile = {
  target: string;
  filename: string;
  rowCount: number;
  csv: string;
};

export type MaintenanceCsvExportResponse = {
  files: MaintenanceCsvExportFile[];
};
