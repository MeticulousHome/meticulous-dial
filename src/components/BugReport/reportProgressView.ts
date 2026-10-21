import type { ReportProgress, ReportStage } from './reportProgressTypes.ts';

/**
 * What the progress view of the bubble draws for a report, from the payload
 * alone (bug report progress, contract v1): the label of the stage, the
 * segments, the detail and the closing label. Clients draw from `stages`, never
 * from a fixed list, and meet unknown stages without failing.
 */

// The stage labels of the contract; the same words as the mobile app.
export const STAGE_LABELS: Record<ReportStage, string> = {
  queued: 'Waiting for the machine',
  preparing: 'Preparing',
  fetching_machine_info: 'Fetching machine info',
  fetching_logs: 'Fetching logs',
  fetching_machine_status: 'Fetching machine status',
  collecting_debug_shots: 'Collecting debug shots',
  ticketing: 'Getting a ticket number',
  compressing: 'Compressing',
  uploading: 'Uploading',
  finishing: 'Finishing',
  submitted: 'Report sent',
  failed: 'Report failed',
  cancelled: 'Report cancelled'
};

/** For a stage a newer backend added, which the contract has no label for. */
export const UNKNOWN_STAGE_LABEL = 'Working on it';

export const NOT_CANCELLABLE_NOTE =
  'It can no longer be cancelled: the report is being uploaded.';

export const stageLabel = (stage: string): string =>
  Object.prototype.hasOwnProperty.call(STAGE_LABELS, stage)
    ? STAGE_LABELS[stage as ReportStage]
    : UNKNOWN_STAGE_LABEL;

/** `3/10` while the machine reports a count, nothing otherwise. */
export const detailLabel = (progress: ReportProgress): string | null => {
  const detail = progress.detail;
  if (
    !detail ||
    !Number.isFinite(detail.current) ||
    !Number.isFinite(detail.total)
  ) {
    return null;
  }
  return `${detail.current}/${detail.total}`;
};

/**
 * The option under the cursor once the list has `length` options: an index
 * left past the end by a list that shrank lands on the last one.
 */
export const clampIndex = (index: number, length: number): number =>
  Math.max(0, Math.min(index, length - 1));

export type SegmentState = 'done' | 'current' | 'pending';

/**
 * One segment per entry of `stages`, in order. Everything before the current
 * stage is done, the stage itself is current, the rest pending. A report that
 * sent is all done; one that failed or was cancelled stops where it was, which
 * the payload does not say, so none of it is marked. A stage `stages` does not
 * list marks nothing either.
 */
export const segmentsFor = (progress: ReportProgress): SegmentState[] => {
  const stages = Array.isArray(progress.stages) ? progress.stages : [];
  if (progress.stage === 'submitted') return stages.map(() => 'done');
  const at = stages.indexOf(progress.stage);
  return stages.map((_, index) =>
    at < 0 || index > at ? 'pending' : index < at ? 'done' : 'current'
  );
};

/** What the view says once the report is over. */
export const finalLabel = (progress: ReportProgress): string => {
  if (progress.stage === 'failed') {
    const code = progress.failure?.code;
    return code ? `${STAGE_LABELS.failed} (${code})` : STAGE_LABELS.failed;
  }
  return stageLabel(progress.stage);
};

/** The line under the stage: the ticket, when the report has one. */
export const ticketLabel = (progress: ReportProgress): string | null =>
  typeof progress.ticket === 'number' ? `Ticket #${progress.ticket}` : null;
