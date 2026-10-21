// Mirrors espresso-api 0.17.0 (bug report progress, contract v1); delete this file when the Dial moves to that version.

export type ReportStage =
  | 'queued'
  | 'preparing'
  | 'fetching_machine_info'
  | 'fetching_logs'
  | 'fetching_machine_status'
  | 'collecting_debug_shots'
  | 'ticketing'
  | 'compressing'
  | 'uploading'
  | 'finishing'
  | 'submitted'
  | 'failed'
  | 'cancelled';

export interface ReportProgress {
  v: 1;
  localID: string;
  origin: 'dial' | 'mobile';
  ticket: number | null;
  stage: ReportStage;
  stages: ReportStage[];
  detail: { current: number; total: number } | null;
  cancellable: boolean;
  final: boolean;
  failure: { code: string; message: string } | null;
  startedAt: number;
  updatedAt: number;
}

export type ReportProgressUpdate =
  | { stage: 'ticketing' | 'uploading' }
  | { failed: { code: string; message: string } };
