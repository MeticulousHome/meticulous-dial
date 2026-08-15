import { useEffect, useMemo, useState } from 'react';
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

const COMMUNITY_APP_URL =
  import.meta.env.VITE_COMMUNITY_APP_URL ||
  'https://community.meticuloushome.com';

type ScreenMode = 'overview' | 'pairing' | 'disconnect';

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
  const { data: deviceInfo } = useDeviceInfo();
  const [mode, setMode] = useState<ScreenMode>('overview');
  const [activeAction, setActiveAction] = useState(0);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const status = statusQuery.data;
  const connected = status?.connected === true;
  const busy =
    beginEnrollment.isPending || setPaused.isPending || disconnect.isPending;
  const error =
    beginEnrollment.error ||
    setPaused.error ||
    disconnect.error ||
    statusQuery.error;

  useEffect(() => {
    if (!pairingExpiresAt) return;
    const interval = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000
    );
    return () => window.clearInterval(interval);
  }, [pairingExpiresAt]);

  useEffect(() => {
    if (connected) {
      setMode('overview');
      setPairingUrl(null);
      setPairingExpiresAt(null);
      setActiveAction(0);
    }
  }, [connected]);

  const actions = useMemo(() => {
    if (!connected) return ['Connect', 'Back'];
    return [
      status?.paused ? 'Resume uploads' : 'Pause uploads',
      'Disconnect',
      'Back'
    ];
  }, [connected, status?.paused]);

  const goBack = () => {
    dispatch(setBubbleDisplay({ visible: true, component: 'settings' }));
  };

  const begin = async () => {
    const enrollment = await beginEnrollment.mutateAsync(deviceInfo?.serial);
    setPairingUrl(enrollment.qrUrl);
    setPairingExpiresAt(enrollment.expiresAt);
    setNow(Math.floor(Date.now() / 1000));
    setMode('pairing');
    setActiveAction(0);
  };

  useHandleGestures({
    left() {
      if (mode === 'pairing') return;
      setActiveAction((previous) => Math.max(previous - 1, 0));
    },
    right() {
      if (mode === 'pairing') return;
      const max = mode === 'disconnect' ? 1 : actions.length - 1;
      setActiveAction((previous) => Math.min(previous + 1, max));
    },
    pressDown() {
      if (busy) return;
      if (mode === 'pairing') {
        setMode('overview');
        setActiveAction(0);
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
      if (action === 'Connect') {
        void begin();
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

  if (mode === 'pairing' && pairingUrl) {
    const secondsLeft = Math.max((pairingExpiresAt ?? now) - now, 0);
    return (
      <div className="community-screen">
        <h2>Connect to Community</h2>
        <p className="community-copy">
          In the Community app, open My Machine and scan this security code.
        </p>
        <div className="community-qr">
          <QRCode value={pairingUrl} width={210} height={210} />
        </div>
        <p className="community-copy">
          Code expires in {Math.floor(secondsLeft / 60)}:
          {String(secondsLeft % 60).padStart(2, '0')}. Press to go back.
        </p>
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

  return (
    <div className="community-screen">
      <h2>Community</h2>
      {!connected ? (
        <>
          <p className="community-copy">
            Back up your Profiles and Brews to Meticulous Community. New shots
            are uploaded privately to your account.
          </p>
          <div className="community-qr">
            <QRCode value={COMMUNITY_APP_URL} width={160} height={160} />
          </div>
          <p className="community-copy">
            Scan to get the Community app. If you already have it, select
            Connect.
          </p>
        </>
      ) : (
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
      )}

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
