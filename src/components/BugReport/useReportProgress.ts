import { useSyncExternalStore } from 'react';

import { ownReport } from './ownReport';
import { reportProgressStore } from './reportProgressStore';

/** Every report the machine has told about, oldest first. */
export const useReportProgressList = () =>
  useSyncExternalStore(
    reportProgressStore.subscribe,
    reportProgressStore.getSnapshot
  );

/** One report by localID; undefined once it is gone. */
export const useReportProgress = (localID: string | null) => {
  const list = useReportProgressList();
  return localID === null
    ? undefined
    : list.find((entry) => entry.localID === localID);
};

/** Whether a report that is not over exists (the label in quick settings). */
export const useReportInProgress = () =>
  useSyncExternalStore(
    reportProgressStore.subscribe,
    () => reportProgressStore.pickActive() !== undefined
  );

/** Whether the Dial's own quick report is running, by its local state. */
export const useOwnReportRunning = () =>
  useSyncExternalStore(ownReport.subscribe, ownReport.isRunning);
