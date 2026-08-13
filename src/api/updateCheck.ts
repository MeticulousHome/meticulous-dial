export type UpdateCheckResult =
  | 'accepted'
  | 'update-active'
  | 'cooldown'
  | 'failed';

export type UpdateCheckFeedback = 'idle' | 'pending' | UpdateCheckResult;

export const UPDATE_CHECK_LABEL = 'Check for updates';
export const UPDATE_CHECK_FEEDBACK_DURATION_MS = 5_000;

const updateCheckLabels: Record<UpdateCheckFeedback, string> = {
  idle: UPDATE_CHECK_LABEL,
  pending: 'Checking for updates...',
  accepted: 'Update check requested',
  'update-active': 'Update already active',
  cooldown: 'Update check available later',
  failed: 'Unable to check for updates'
};

type TimeoutHandle = ReturnType<typeof setTimeout>;
type ScheduleTimeout = (callback: () => void, delay: number) => TimeoutHandle;
type CancelTimeout = (handle: TimeoutHandle) => void;

export const getUpdateCheckLabel = (feedback: UpdateCheckFeedback) =>
  updateCheckLabels[feedback];

export function createUpdateCheckFeedback(
  onChange: (feedback: UpdateCheckFeedback) => void,
  scheduleTimeout: ScheduleTimeout = setTimeout,
  cancelTimeout: CancelTimeout = clearTimeout
) {
  let resetTimer: TimeoutHandle | null = null;

  const clearResetTimer = () => {
    if (resetTimer !== null) {
      cancelTimeout(resetTimer);
      resetTimer = null;
    }
  };

  return {
    pending() {
      clearResetTimer();
      onChange('pending');
    },
    completed(result: UpdateCheckResult) {
      clearResetTimer();
      onChange(result);
      resetTimer = scheduleTimeout(() => {
        resetTimer = null;
        onChange('idle');
      }, UPDATE_CHECK_FEEDBACK_DURATION_MS);
    },
    dispose: clearResetTimer
  };
}

async function requestUpdateCheck(
  apiUrl: string,
  fetchRequest: typeof fetch
): Promise<UpdateCheckResult> {
  try {
    const response = await fetchRequest(`${apiUrl}/api/v1/update/check`, {
      method: 'POST'
    });

    if (response.ok) {
      return 'accepted';
    }

    if (response.status === 409) {
      return 'update-active';
    }

    if (response.status === 429) {
      return 'cooldown';
    }

    return 'failed';
  } catch {
    return 'failed';
  }
}

export function createUpdateCheck(
  apiUrl: string,
  fetchRequest: typeof fetch = fetch
) {
  let pendingRequest: Promise<UpdateCheckResult> | null = null;

  return () => {
    if (!pendingRequest) {
      pendingRequest = requestUpdateCheck(apiUrl, fetchRequest).finally(() => {
        pendingRequest = null;
      });
    }

    return pendingRequest;
  };
}
