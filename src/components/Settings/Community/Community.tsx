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

function secondsRemaining(
  expiresAt: number | null,
  now: number
): string | null {
  if (!expiresAt) return null;
  const seconds = Math.max(expiresAt - now, 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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
      // The mutation exposes its user-facing error below.
    } finally {
      enrollmentInFlight.current = false;
    }
  }, [beginEnrollment, connected, deviceInfo?.serial]);

  useEffect(() => {
    if (
      statusQuery.isPending ||
      deviceInfoPending ||
      connected ||
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
    statusQuery.isPending
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
  }, [connected]);

  useEffect(() => {
    if (
      connected ||
      !pairingExpiresAt ||
      now < pairingExpiresAt ||
      beginEnrollment.isPending
    ) {
      return;
    }

    enrollmentAttempted.current = false;
    setPairingUrl(null);
    setPairingExpiresAt(null);
    beginEnrollment.reset();
  }, [beginEnrollment, connected, now, pairingExpiresAt]);

  const actions = useMemo(() => {
    if (!connected) {
      return beginEnrollment.isError ? ['Try again', 'Back'] : ['Back'];
    }
    return [
      'Back',
      status?.paused ? 'Resume uploads' : 'Pause uploads',
      'Disconnect'
    ];
  }, [beginEnrollment.isError, connected, status?.paused]);

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
          setActiveAction(0);
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
        pairingWasActive.current = true;
        setPairingUrl(null);
        setPairingExpiresAt(null);
        beginEnrollment.reset();
        setActiveAction(0);
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
      <div className="community-screen community-screen-dialog">
        <h2>Disconnect Community?</h2>
        <p className="community-copy">
          New brews will stop uploading. Brews already in Community will remain
          in your account.
        </p>
        <div className="community-actions community-actions-two">
          {['Cancel', 'Disconnect'].map((label, index) => (
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

  if (mode === 'connected-success') {
    return (
      <div className="community-screen community-screen-dialog">
        <div className="community-success-mark" aria-hidden="true">
          ✓
        </div>
        <h2>Connected to Community</h2>
        <p className="community-copy">
          New brews will upload privately to your account.
        </p>
        <div className="community-actions community-actions-single">
          <div className="community-action active">Done</div>
        </div>
      </div>
    );
  }

  if (!connected) {
    const timeLeft = secondsRemaining(pairingExpiresAt, now);
    return (
      <div className="community-screen community-screen-connect">
        <h2>Connect to Community</h2>
        <p className="community-copy">Scan this secure code with your phone.</p>
        {pairingUrl ? (
          <div className="community-qr">
            <QRCode value={pairingUrl} width={176} height={176} />
          </div>
        ) : (
          <div className="community-qr-placeholder" role="status">
            {beginEnrollment.isError
              ? 'Could not create a secure code'
              : 'Creating secure code...'}
          </div>
        )}
        <p className="community-expiry">
          {timeLeft ? `Code expires in ${timeLeft}` : 'Keep this screen open'}
        </p>
        <div
          className={`community-actions ${actions.length === 1 ? 'community-actions-single' : 'community-actions-two'}`}
        >
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
    <div className="community-screen community-screen-overview">
      <h2>Community</h2>
      <div className="community-status-grid">
        <span>Status</span>
        <span>{status.paused ? 'Upload paused' : 'Connected'}</span>
        <span>Last upload</span>
        <span>{formatTimestamp(status.lastSuccessAt)}</span>
        <span>Waiting</span>
        <span>{status.pendingCount}</span>
        <span>Last error</span>
        <span>{readableError(status.lastError)}</span>
      </div>
      <div className="community-actions community-actions-three">
        {actions.map((label, index) => (
          <div
            className={`community-action ${activeAction === index ? 'active' : ''}`}
            key={label}
          >
            {busy && activeAction === index ? 'Working...' : label}
          </div>
        ))}
      </div>
      <p className="community-gesture-hint">Turn to choose, press to select</p>
      {error ? <p className="community-error">{String(error)}</p> : null}
    </div>
  );
}
