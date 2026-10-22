import type { ReportProgress } from './reportProgressTypes';
import {
  detailLabel,
  finalLabel,
  NOT_CANCELLABLE_NOTE,
  segmentsFor,
  stageLabel,
  ticketLabel
} from './reportProgressViewHelpers';

/**
 * The body of the non-blocking progress view: where a report stands, drawn
 * from the machine's payload (see reportProgressViewHelpers.ts). The options below it
 * (Cancel, Back or Exit) belong to BugReport.
 */
export const ReportProgressView = ({
  progress,
  notCancellable
}: {
  progress: ReportProgress;
  /** Cancel is gone because the upload started (or the machine said so). */
  notCancellable: boolean;
}): JSX.Element => {
  const label = progress.final
    ? finalLabel(progress)
    : stageLabel(progress.stage);
  const detail = progress.final ? null : detailLabel(progress);
  const ticket = ticketLabel(progress);
  const segments = segmentsFor(progress);

  return (
    <div className="bug-report-progress">
      {ticket && <span className="bug-report-eyebrow">{ticket}</span>}
      <span className="bug-report-progress-stage">{label}</span>
      {detail && <span className="bug-report-progress-detail">{detail}</span>}
      <div
        className="bug-report-progress-segments"
        role="progressbar"
        aria-label={label}
      >
        {segments.map((state, index) => (
          <span
            key={index}
            className={`bug-report-progress-segment bug-report-progress-segment-${state}`}
          />
        ))}
      </div>
      {notCancellable && !progress.final && (
        <span className="bug-report-error-note">{NOT_CANCELLABLE_NOTE}</span>
      )}
    </div>
  );
};
