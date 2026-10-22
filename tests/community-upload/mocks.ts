import type {
  CommunityHistoryRecovery,
  CommunityUploadStatus
} from '../../src/hooks/useCommunityUpload';

const recovery: CommunityHistoryRecovery = {
  state: 'running',
  added: 0,
  alreadyPresent: 0,
  preservedDeleted: 0,
  failed: 0,
  pendingCount: 0,
  lastError: null
};
export const probe = {
  ready: false,
  calls: [] as { command: string; args?: Record<string, unknown> }[],
  dispatches: [] as unknown[],
  status: {
    state: 'connected',
    connected: true,
    paused: false,
    pendingCount: 0,
    lastSuccessAt: null,
    lastError: null,
    lastRetryAt: null,
    enrollmentExpiresAt: null,
    recovery: null
  } as CommunityUploadStatus,
  // Models the native worker independently of any component or IPC mutation.
  runNativeWorkerTick() {
    if (probe.status.connected && !probe.status.recovery)
      probe.status.recovery = { ...recovery };
  },
  startError: null as string | null,
  statusError: false,
  holdStart: false,
  releaseStart: null as (() => void) | null,
  setStatus(patch: Partial<CommunityUploadStatus>) {
    Object.assign(probe.status, patch);
  }
};

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  probe.calls.push({ command, args });
  switch (command) {
    case 'community_upload_status':
      if (probe.statusError) throw 'status_unavailable';
      return structuredClone(probe.status) as T;
    case 'community_start_history_recovery':
      if (probe.holdStart)
        await new Promise<void>((resolve) => {
          probe.releaseStart = resolve;
        });
      if (probe.startError) throw probe.startError;
      if (probe.status.recovery?.state !== 'running')
        probe.status.recovery = { ...recovery };
      return undefined as T;
    case 'community_set_upload_paused':
      probe.status.paused = args?.paused as boolean;
      return undefined as T;
    case 'community_disconnect':
      probe.status.connected = false;
      probe.status.state = 'not_connected';
      return undefined as T;
    case 'community_begin_enrollment':
      return {
        qrUrl: 'https://example.test/community/connect?code=fixture',
        expiresAt: Math.floor(Date.now() / 1000) + 300
      } as T;
    default:
      throw new Error(`Unexpected IPC command: ${command}`);
  }
}

export const useDeviceInfo = () => ({
  data: { serial: 'fixture-machine' },
  isPending: false
});
export const useAppDispatch = () => (action: unknown) =>
  probe.dispatches.push(action);
