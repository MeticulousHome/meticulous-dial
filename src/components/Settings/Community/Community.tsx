import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import {
  useBeginCommunityEnrollment,
  useCommunityUploadStatus,
  useDisconnectCommunity,
  useStartCommunityHistoryRecovery,
  useSetCommunityUploadPaused
} from '../../../hooks/useCommunityUpload';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch } from '../../store/hooks';
import './Community.css';

type ScreenMode =
  | 'overview'
  | 'connected-success'
  | 'disconnect'
  | 'import-confirm'
  | 'import-progress';

function formatTimestamp(value: number | null | undefined): string {
  if (!value) return 'Not yet';
  return new Date(value * 1000).toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function readableError(value: string | null | undefined): string {
  if (!value) return 'None';
  return value.replace(/_/g, ' ');
}

function recoveryError(value: unknown): string {
  const category = typeof value === 'string' ? value : '';
  if (
    category === 'waiting_server_upgrade' ||
    category === 'recovery_server_upgrade_required'
  )
    return 'Waiting for the Community update. Import will resume automatically.';
  if (category === 'machine_pour_over_history_unavailable')
    return 'Pour-over history is unavailable. The import will retry.';
  if (category.includes('authorization') || category.includes('not_connected'))
    return 'Reconnect to Community, then import again.';
  if (category.includes('persist') || category.includes('storage'))
    return 'Could not save import progress. Check machine storage.';
  if (category.includes('too_large') || category.includes('oversized'))
    return 'A saved brew exceeds the upload size limit.';
  if (category.includes('invalid') || category.includes('unsupported'))
    return 'Some saved history could not be read.';
  if (category.includes('capacity') || category.includes('queue_full'))
    return 'Waiting for pending uploads to make room.';
  return 'Import needs another attempt. Check the connection.';
}

function Actions({
  labels,
  active,
  busy,
  onSelect
}: {
  labels: string[];
  active: number;
  busy: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      className={`community-actions ${labels.length > 2 ? 'community-actions-grid' : ''}`}
    >
      {labels.map((label, index) => (
        <button
          type="button"
          className={`community-action ${active === index ? 'active' : ''}`}
          key={label}
          disabled={busy}
          aria-current={active === index ? 'true' : undefined}
          onClick={() => onSelect(index)}
        >
          {busy && active === index ? 'Working...' : label}
        </button>
      ))}
    </div>
  );
}

export function CommunitySettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const statusQuery = useCommunityUploadStatus();
  const beginEnrollment = useBeginCommunityEnrollment();
  const setPaused = useSetCommunityUploadPaused();
  const disconnect = useDisconnectCommunity();
  const startRecovery = useStartCommunityHistoryRecovery();
  const { data: deviceInfo, isPending: deviceInfoPending } = useDeviceInfo();
  const [mode, setMode] = useState<ScreenMode>('overview');
  const [activeAction, setActiveAction] = useState(0);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const enrollmentAttempted = useRef(false);
  const enrollmentInFlight = useRef(false);
  const pairingWasActive = useRef(false);

  const status = statusQuery.data;
  const connected = status?.connected === true;
  const unavailable = status?.state === 'unavailable';
  const pairingExpired = Boolean(pairingExpiresAt && now >= pairingExpiresAt);
  const busy =
    beginEnrollment.isPending ||
    setPaused.isPending ||
    disconnect.isPending ||
    startRecovery.isPending;
  const error =
    beginEnrollment.error ||
    setPaused.error ||
    disconnect.error ||
    startRecovery.error ||
    statusQuery.error;

  const startEnrollment = useCallback(async () => {
    if (enrollmentInFlight.current || connected) return;

    enrollmentAttempted.current = true;
    enrollmentInFlight.current = true;
    pairingWasActive.current = true;
    beginEnrollment.reset();
    setPairingUrl(null);
    setPairingExpiresAt(null);

    try {
      const enrollment = await beginEnrollment.mutateAsync(deviceInfo?.serial);
      setPairingUrl(enrollment.qrUrl);
      setPairingExpiresAt(enrollment.expiresAt);
      setNow(Math.floor(Date.now() / 1000));
    } catch {
      // The mutation exposes a safe user-facing error below.
    } finally {
      enrollmentInFlight.current = false;
    }
  }, [beginEnrollment, connected, deviceInfo?.serial]);

  useEffect(() => {
    if (
      statusQuery.isPending ||
      statusQuery.isError ||
      deviceInfoPending ||
      connected ||
      unavailable ||
      pairingUrl ||
      beginEnrollment.isPending ||
      enrollmentAttempted.current
    ) {
      return;
    }
    void startEnrollment();
  }, [
    beginEnrollment.isPending,
    connected,
    deviceInfoPending,
    pairingUrl,
    startEnrollment,
    statusQuery.isPending,
    statusQuery.isError,
    unavailable
  ]);

  useEffect(() => {
    if (!pairingExpiresAt) return;
    const interval = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000
    );
    return () => window.clearInterval(interval);
  }, [pairingExpiresAt]);

  useEffect(() => {
    if (connected && pairingWasActive.current) {
      pairingWasActive.current = false;
      setMode('connected-success');
      setPairingUrl(null);
      setPairingExpiresAt(null);
      setActiveAction(0);
    }
  }, [connected, mode]);

  const recovery = status?.recovery;
  const actions = useMemo(() => {
    if (connected && statusQuery.isError) return ['Back', 'Retry'];
    if (connected && mode === 'connected-success') return ['Done'];
    if (mode === 'disconnect') return ['Cancel', 'Disconnect'];
    if (connected && mode === 'import-confirm') return ['Cancel', 'Import all'];
    if (connected && mode === 'import-progress') {
      if (!recovery) return ['Back', 'Retry'];
      return recovery?.state === 'running'
        ? ['Back', status?.paused ? 'Resume uploads' : 'Pause uploads']
        : ['Back', 'Import again'];
    }
    if (!connected) {
      if (statusQuery.isError) return ['Retry', 'Back'];
      if (unavailable || statusQuery.isPending) return ['Back'];
      return beginEnrollment.isError || pairingExpired
        ? ['Try again', 'Back']
        : ['Back'];
    }
    return [
      'Back',
      status?.paused ? 'Resume uploads' : 'Pause uploads',
      recovery ? 'View saved import' : 'Import saved brews',
      'Disconnect'
    ];
  }, [
    mode,
    recovery,
    beginEnrollment.isError,
    connected,
    pairingExpired,
    status?.paused,
    statusQuery.isError,
    statusQuery.isPending,
    unavailable
  ]);

  const selectedAction = Math.min(activeAction, actions.length - 1);

  const changeMode = (next: ScreenMode) => {
    setMode(next);
    setActiveAction(0);
    startRecovery.reset();
    setPaused.reset();
    disconnect.reset();
  };

  const goBack = () => {
    dispatch(setBubbleDisplay({ visible: true, component: 'settings' }));
  };

  const selectAction = (index: number) => {
    if (busy) return;
    setActiveAction(index);
    const action = actions[index];
    if (action === 'Done') {
      changeMode('overview');
      goBack();
    } else if (action === 'Cancel') {
      changeMode('overview');
    } else if (action === 'Import all') {
      void startRecovery
        .mutateAsync()
        .then(() => {
          changeMode('import-progress');
        })
        .catch(() => {
          /* The mutation exposes the error below. */
        });
    } else if (action === 'Import saved brews' || action === 'Import again') {
      changeMode('import-confirm');
    } else if (action === 'View saved import') {
      changeMode('import-progress');
    } else if (action === 'Try again') {
      enrollmentAttempted.current = false;
      setPairingUrl(null);
      setPairingExpiresAt(null);
      beginEnrollment.reset();
    } else if (action === 'Retry') {
      void statusQuery.refetch();
    } else if (action === 'Pause uploads' || action === 'Resume uploads') {
      setPaused.mutate(action === 'Pause uploads');
    } else if (action === 'Disconnect') {
      if (mode !== 'disconnect') {
        changeMode('disconnect');
      } else {
        void disconnect
          .mutateAsync()
          .then(() => {
            changeMode('overview');
          })
          .catch(() => {
            /* The mutation exposes the error below. */
          });
      }
    } else if (action === 'Back') {
      if (mode === 'import-progress' || mode === 'import-confirm')
        changeMode('overview');
      else goBack();
    }
  };

  useHandleGestures({
    left() {
      if (busy) return;
      setActiveAction((previous) =>
        Math.max(Math.min(previous, actions.length - 1) - 1, 0)
      );
    },
    right() {
      if (busy) return;
      setActiveAction((previous) => Math.min(previous + 1, actions.length - 1));
    },
    pressDown() {
      selectAction(selectedAction);
    }
  });

  const actionButtons = (
    <Actions
      labels={actions}
      active={selectedAction}
      busy={busy}
      onSelect={selectAction}
    />
  );

  if (connected && mode === 'import-confirm') {
    return (
      <div className="community-screen">
        <h2>Import saved brews?</h2>
        <p className="community-copy">
          Add all saved espresso and pour-over brews from this machine to your
          connected Community account’s private history.
        </p>
        <p className="community-copy">
          Existing brews won’t be duplicated. Deleted brews stay deleted.
        </p>
        <p className="community-copy">
          {status.paused
            ? 'Uploads are paused. Resume them to begin importing.'
            : 'You can keep brewing while the import runs.'}
        </p>
        {actionButtons}
        {error ? (
          <p className="community-error" role="alert">
            {statusQuery.isError
              ? 'Could not refresh the connection. Please retry.'
              : recoveryError(error)}
          </p>
        ) : null}
      </div>
    );
  }

  if (connected && mode === 'import-progress' && !recovery) {
    return (
      <div className="community-screen">
        <h2>Saved brew import</h2>
        <p className="community-copy" role="status">
          {statusQuery.isError
            ? 'Could not load import progress. Please retry.'
            : 'Waiting for import progress…'}
        </p>
        {actionButtons}
      </div>
    );
  }

  if (connected && mode === 'import-progress') {
    const running = recovery?.state === 'running';
    const interrupted = recovery?.state === 'interrupted';
    const hasIssues = (recovery?.failed ?? 0) > 0;
    const title = running
      ? status.paused
        ? 'Import paused'
        : 'Importing saved brews'
      : interrupted
        ? 'Import interrupted'
        : hasIssues
          ? 'Import finished with issues'
          : 'Import complete';
    return (
      <div className="community-screen community-screen-recovery">
        <h2>{title}</h2>
        <p className="community-copy">
          {running
            ? status.paused
              ? 'Resume uploads to continue this import and new brew uploads.'
              : 'Espresso and pour-over history. New brews continue uploading.'
            : interrupted
              ? 'The connection changed. Confirm again to import to this account.'
              : hasIssues
                ? 'Some saved brews could not be imported. You can try again.'
                : 'All available saved history has been checked.'}
        </p>
        <div
          className="community-status-grid community-recovery-counts"
          aria-label="Import results"
        >
          <span>Added to Community</span>
          <span>{recovery?.added ?? 0}</span>
          <span>Already in Community</span>
          <span>{recovery?.alreadyPresent ?? 0}</span>
          <span>Kept deleted</span>
          <span>{recovery?.preservedDeleted ?? 0}</span>
          <span>Could not import</span>
          <span>{recovery?.failed ?? 0}</span>
          <span>Pending uploads</span>
          <span>{recovery?.pendingCount ?? 0}</span>
        </div>
        {error || recovery?.lastError ? (
          <p className="community-error" role="alert">
            {statusQuery.isError
              ? 'Could not refresh progress. Please retry.'
              : recoveryError(error || recovery?.lastError)}
          </p>
        ) : null}
        {actionButtons}
      </div>
    );
  }

  if (mode === 'disconnect') {
    return (
      <div className="community-screen">
        <h2>Disconnect Community?</h2>
        <p className="community-copy">
          Future uploads will stop. Shots already stored in Community will
          remain in your account.
        </p>
        {actionButtons}
        {error ? (
          <p className="community-error" role="alert">
            {statusQuery.isError
              ? 'Could not refresh the connection. Please retry.'
              : 'Could not update Community. Please try again.'}
          </p>
        ) : null}
      </div>
    );
  }

  if (mode === 'connected-success') {
    return (
      <div className="community-screen">
        <h2>Connected to Community</h2>
        <p className="community-copy">
          New shots will be uploaded privately to your account.
        </p>
        {actionButtons}
      </div>
    );
  }

  if (!connected) {
    if (statusQuery.isPending || statusQuery.isError) {
      return (
        <div className="community-screen">
          <h2>Community</h2>
          <p className="community-copy" role="status">
            {statusQuery.isPending
              ? 'Loading connection…'
              : 'Could not load the connection. Please try again.'}
          </p>
          {actionButtons}
        </div>
      );
    }
    if (unavailable) {
      return (
        <div className="community-screen">
          <h2>Community Unavailable</h2>
          <p className="community-copy">
            Automatic backup could not access its storage. Brewing and Espresso
            remain available. Restart the Dial after checking machine storage.
          </p>
          {actionButtons}
          <p className="community-error">{readableError(status?.lastError)}</p>
        </div>
      );
    }
    const secondsLeft = Math.max((pairingExpiresAt ?? now) - now, 0);
    return (
      <div className="community-screen community-screen-connect">
        <h2>Connect to Community</h2>
        <p className="community-copy">
          Scan this secure code with your phone. It opens Community or helps you
          install the app.
        </p>
        {pairingUrl && !pairingExpired ? (
          <div className="community-qr">
            <QRCode value={pairingUrl} size={200} />
          </div>
        ) : (
          <div className="community-qr-placeholder" role="status">
            {pairingExpired
              ? 'Secure code expired'
              : beginEnrollment.isError
                ? 'Could not create a secure code'
                : 'Creating secure code...'}
          </div>
        )}
        <p className="community-copy">
          {pairingExpired ? (
            'Choose Try again to create a new secure code.'
          ) : pairingUrl ? (
            <>
              Sign in, review private backup, then connect. Code expires in{' '}
              {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, '0')}.
            </>
          ) : (
            'Keep this screen open while Community prepares the connection.'
          )}
        </p>
        {actionButtons}
        {error ? (
          <p className="community-error" role="alert">
            {statusQuery.isError
              ? 'Could not refresh the connection. Please retry.'
              : 'Could not update Community. Please try again.'}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="community-screen">
      <h2>Community</h2>
      <div className="community-status-grid">
        <span>Status</span>
        <span>{status.paused ? 'Upload paused' : 'Connected'}</span>
        <span>Last upload</span>
        <span>{formatTimestamp(status.lastSuccessAt)}</span>
        <span>Pending</span>
        <span>{status.pendingCount}</span>
        <span>Retry state</span>
        <span>{readableError(status.lastError)}</span>
      </div>

      {actionButtons}
      {error ? (
        <p className="community-error" role="alert">
          {statusQuery.isError
            ? 'Could not refresh the connection. Please retry.'
            : 'Could not update Community. Please try again.'}
        </p>
      ) : null}
    </div>
  );
}
