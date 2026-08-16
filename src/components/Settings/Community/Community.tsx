import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import {
  useBeginCommunityEnrollment,
  useCommunityUploadStatus,
  useDisconnectCommunity,
  useSetCommunityUploadPaused
} from '../../../hooks/useCommunityUpload';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch } from '../../store/hooks';
import './Community.css';

type ScreenMode = 'overview' | 'connected-success' | 'disconnect';

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

export function CommunitySettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const statusQuery = useCommunityUploadStatus();
  const beginEnrollment = useBeginCommunityEnrollment();
  const setPaused = useSetCommunityUploadPaused();
  const disconnect = useDisconnectCommunity();
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
    beginEnrollment.isPending || setPaused.isPending || disconnect.isPending;
  const error =
    beginEnrollment.error ||
    setPaused.error ||
    disconnect.error ||
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

  const actions = useMemo(() => {
    if (!connected) {
      if (unavailable) return ['Back'];
      return beginEnrollment.isError || pairingExpired
        ? ['Try again', 'Back']
        : ['Back'];
    }
    return [
      'Back',
      status?.paused ? 'Resume uploads' : 'Pause uploads',
      'Disconnect'
    ];
  }, [
    beginEnrollment.isError,
    connected,
    pairingExpired,
    status?.paused,
    unavailable
  ]);

  const goBack = () => {
    dispatch(setBubbleDisplay({ visible: true, component: 'settings' }));
  };

  useHandleGestures({
    left() {
      if (mode === 'connected-success') return;
      setActiveAction((previous) => Math.max(previous - 1, 0));
    },
    right() {
      if (mode === 'connected-success') return;
      const max = mode === 'disconnect' ? 1 : actions.length - 1;
      setActiveAction((previous) => Math.min(previous + 1, max));
    },
    pressDown() {
      if (busy) return;
      if (mode === 'connected-success') {
        setMode('overview');
        setActiveAction(0);
        goBack();
        return;
      }
      if (mode === 'disconnect') {
        if (activeAction === 0) {
          setMode('overview');
          return;
        }
        void disconnect.mutateAsync().then(() => {
          setMode('overview');
          setActiveAction(0);
        });
        return;
      }
      const action = actions[activeAction];
      if (action === 'Try again') {
        enrollmentAttempted.current = false;
        setPairingUrl(null);
        setPairingExpiresAt(null);
        beginEnrollment.reset();
      } else if (action === 'Pause uploads') {
        void setPaused.mutateAsync(true);
      } else if (action === 'Resume uploads') {
        void setPaused.mutateAsync(false);
      } else if (action === 'Disconnect') {
        setMode('disconnect');
        setActiveAction(0);
      } else if (action === 'Back') {
        goBack();
      }
    }
  });

  if (mode === 'disconnect') {
    return (
      <div className="community-screen">
        <h2>Disconnect Community?</h2>
        <p className="community-copy">
          Future uploads will stop. Shots already stored in Community will
          remain in your account.
        </p>
        <div className="community-actions">
          {['Cancel', 'Disconnect'].map((label, index) => (
            <div
              className={`community-action ${activeAction === index ? 'active' : ''}`}
              key={label}
            >
              {label}
            </div>
          ))}
        </div>
        {error ? <p className="community-error">{String(error)}</p> : null}
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
        <div className="community-actions">
          <div className="community-action active">Done</div>
        </div>
      </div>
    );
  }

  if (!connected) {
    if (unavailable) {
      return (
        <div className="community-screen">
          <h2>Community Unavailable</h2>
          <p className="community-copy">
            Automatic backup could not access its storage. Brewing and Espresso
            remain available. Restart the Dial after checking machine storage.
          </p>
          <div className="community-actions">
            <div className="community-action active">Back</div>
          </div>
          <p className="community-error">
            {readableError(status?.lastError)}
          </p>
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
            <QRCode value={pairingUrl} width={200} height={200} />
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
        <div className="community-actions">
          {actions.map((label, index) => (
            <div
              className={`community-action ${activeAction === index ? 'active' : ''}`}
              key={label}
            >
              {busy && activeAction === index ? 'Working...' : label}
            </div>
          ))}
        </div>
        {error ? <p className="community-error">{String(error)}</p> : null}
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

      <div className="community-actions">
        {actions.map((label, index) => (
          <div
            className={`community-action ${activeAction === index ? 'active' : ''}`}
            key={label}
          >
            {busy && activeAction === index ? 'Working...' : label}
          </div>
        ))}
      </div>
      {error ? <p className="community-error">{String(error)}</p> : null}
    </div>
  );
}
