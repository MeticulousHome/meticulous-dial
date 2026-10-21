import type { ReportProgress } from './reportProgressTypes.ts';

/**
 * What the machine says about the reports in flight (bug report progress,
 * contract v1), kept by localID.
 *
 * Fed by the `report_progress` socket event and, on every (re)connect, by
 * GET /reports/progress. `null` from that call means the backend predates
 * progress: the store stays empty and every report flow behaves as it did
 * before the contract. Plain module state with a subscribe, like
 * dispatchedReports.onOutcome, so the headless upload can listen to it too.
 */

// The backend keeps a report that ended for 60 s; the Dial does the same, so a
// final entry it never showed does not pile up.
export const FINAL_KEPT_MS = 60 * 1000;

type Listener = () => void;

type Entry = {
  progress: ReportProgress;
  /** When this entry last changed here; what a snapshot taken earlier loses to. */
  seq: number;
  /** When it turned final here, for the 60 s it is kept. */
  finalAt: number | null;
};

const isProgress = (value: unknown): value is ReportProgress => {
  const candidate = value as Partial<ReportProgress> | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    // A payload of another version may mean something else: ignore it.
    candidate.v === 1 &&
    typeof candidate.localID === 'string' &&
    candidate.localID !== '' &&
    typeof candidate.stage === 'string' &&
    typeof candidate.final === 'boolean'
  );
};

/** Same order as the backend lists them: oldest first. */
const byAge = (a: ReportProgress, b: ReportProgress) =>
  a.startedAt - b.startedAt || (a.localID < b.localID ? -1 : 1);

// Whether `a` stands earlier than `b` in a's `stages`; false when either is
// not listed (unknown stage), where nothing can be said.
const earlier = (a: ReportProgress, b: ReportProgress) => {
  const stages = Array.isArray(a.stages) ? a.stages : [];
  const at = stages.indexOf(a.stage);
  const than = stages.indexOf(b.stage);
  return at >= 0 && than >= 0 && at < than;
};

export const createReportProgressStore = (now: () => number = Date.now) => {
  let entries = new Map<string, Entry>();
  let list: ReportProgress[] = [];
  let seq = 0;
  let viewRequested = false;
  const listeners = new Set<Listener>();

  const publish = () => {
    list = [...entries.values()].map((entry) => entry.progress).sort(byAge);
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[report-progress] listener failed', error);
      }
    });
  };

  const dropExpired = () => {
    let dropped = false;
    entries.forEach((entry, localID) => {
      if (entry.finalAt !== null && now() - entry.finalAt >= FINAL_KEPT_MS) {
        entries.delete(localID);
        dropped = true;
      }
    });
    return dropped;
  };

  // Returns whether the entry changed. A payload older than the one held, or
  // a non-final one after a final one, is a late delivery: stages only move
  // forward and a final stage is never left.
  const merge = (incoming: unknown) => {
    if (!isProgress(incoming)) return false;
    const held = entries.get(incoming.localID);
    if (held) {
      if (held.progress.final && !incoming.final) return false;
      if (incoming.updatedAt < held.progress.updatedAt) return false;
      // updatedAt is in whole seconds: two changes in the same second cannot
      // be ordered by it, so a stage earlier in the report's own `stages`
      // never replaces a later one. A final stage (not in `stages`) wins.
      if (
        incoming.updatedAt === held.progress.updatedAt &&
        !incoming.final &&
        earlier(incoming, held.progress)
      ) {
        return false;
      }
    }
    entries.set(incoming.localID, {
      progress: incoming,
      seq: ++seq,
      finalAt: incoming.final ? (held?.finalAt ?? now()) : null
    });
    return true;
  };

  return {
    /** A `report_progress` event, or the answer to a progress post. */
    apply(incoming: unknown) {
      const expired = dropExpired();
      if (merge(incoming) || expired) publish();
    },

    /**
     * Marks the moment a GET /reports/progress starts. Hand it back to
     * `applySnapshot`: an entry an event touched meanwhile is newer than the
     * answer.
     */
    beginSnapshot() {
      return seq;
    },

    /**
     * The answer of GET /reports/progress. `null`: a backend without progress,
     * nothing is kept. Otherwise the list is the truth: what it does not
     * mention has ended and been forgotten there.
     */
    applySnapshot(snapshot: unknown, token: number = seq) {
      if (!Array.isArray(snapshot)) {
        if (snapshot === null && entries.size > 0) {
          entries = new Map();
          publish();
        }
        return;
      }
      dropExpired();
      const mentioned = new Set<string>();
      snapshot.forEach((item) => {
        merge(item);
        if (isProgress(item)) mentioned.add(item.localID);
      });
      entries.forEach((entry, localID) => {
        if (!mentioned.has(localID) && entry.seq <= token) {
          entries.delete(localID);
        }
      });
      publish();
    },

    /** The final entry was shown; it is not needed any more. */
    acknowledge(localID: string) {
      const held = entries.get(localID);
      if (!held?.progress.final) return;
      entries.delete(localID);
      publish();
    },

    /** Every entry, oldest first. A new array only when something changed. */
    getSnapshot(): ReportProgress[] {
      return list;
    },

    get(localID: string): ReportProgress | undefined {
      return entries.get(localID)?.progress;
    },

    /**
     * The report to show first: the one being worked on before those still
     * waiting in the queue, the oldest first. Only reports not over.
     */
    pickActive(): ReportProgress | undefined {
      return list
        .filter((entry) => !entry.final)
        .sort(
          (a, b) =>
            Number(a.stage === 'queued') - Number(b.stage === 'queued') ||
            byAge(a, b)
        )[0];
    },

    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Quick settings opened the progress view; the bubble reads it once. */
    requestView() {
      viewRequested = true;
    },

    /** Whether the view was requested, without consuming the request. */
    peekViewRequest(): boolean {
      return viewRequested;
    },

    takeViewRequest(): boolean {
      const requested = viewRequested;
      viewRequested = false;
      return requested;
    }
  };
};

export const reportProgressStore = createReportProgressStore();
