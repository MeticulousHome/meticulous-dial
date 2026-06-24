import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState
} from 'react';
import { styled } from 'styled-components';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBrightness } from '../../api/api';
import {
  getBluetoothStatus,
  getWifiRadioStatus,
  MotorMode,
  setBluetoothPower,
  setWifiRadioStatus,
  startMotorHeaterControl,
  stopMotorHeaterControl
} from '../../api/lab';

type LabMenuKey =
  | 'wifi'
  | 'bluetooth'
  | 'band_heater'
  | 'brightness'
  | 'motor'
  | 'motor_mode'
  | 'run'
  | 'back';

type LabMenuItem = {
  key: LabMenuKey;
  label: string;
};

type Setpoints = Record<string, number | string | null | undefined>;
type TelemetryValues = Record<string, number | string | null | undefined>;
type LabIconKey =
  | 'wifi'
  | 'bluetooth'
  | 'motor'
  | 'mode_up'
  | 'mode_down'
  | 'mode_ramp'
  | 'heater'
  | 'brightness'
  | 'lab_start'
  | 'lab_stop'
  | 'back';
type LabControlRow = LabMenuItem & {
  icon: LabIconKey;
  value?: string;
};
type TelemetryRowItem = {
  label: string;
  value: string;
  groupEnd?: boolean;
};

const menuItems: LabMenuItem[] = [
  { key: 'wifi', label: 'WiFi' },
  { key: 'bluetooth', label: 'Bluetooth' },
  { key: 'motor', label: 'Motor' },
  { key: 'motor_mode', label: 'Motor mode' },
  { key: 'band_heater', label: 'Heater' },
  { key: 'brightness', label: 'Brightness' },
  { key: 'run', label: 'Lab mode' },
  { key: 'back', label: 'Back' }
];

const LabScreen = styled.div`
  position: relative;
  width: 480px;
  height: 480px;
  overflow: hidden;
  background: #000;
  color: #e0dcd0;
  font-family: 'ABC Diatype Mono';
  text-transform: uppercase;
`;

const CircleGuide = styled.div`
  position: absolute;
  inset: 7px;
  border: 1px solid rgba(224, 220, 208, 0.16);
  border-radius: 50%;
  pointer-events: none;
`;

const ScreenTitle = styled.div`
  position: absolute;
  top: 36px;
  left: 0;
  width: 100%;
  color: #f5c84b;
  font-size: 27px;
  font-weight: 700;
  line-height: 30px;
  text-align: center;
  text-transform: none;
`;

const ContentRule = styled.div`
  position: absolute;
  top: 96px;
  left: 66px;
  width: 236px;
  height: 1px;
  background: rgba(224, 220, 208, 0.22);
`;

const ControlList = styled.div`
  position: absolute;
  top: 106px;
  left: 66px;
  width: 236px;
`;

const ControlButton = styled.button<{
  $active: boolean;
  $editing: boolean;
}>`
  display: grid;
  grid-template-columns: 34px 1fr max-content;
  align-items: center;
  column-gap: 7px;
  width: 100%;
  height: 33px;
  margin: 0;
  padding: 0 8px 0 4px;
  border: 0;
  border-radius: 6px;
  border-top: 1px solid rgba(224, 220, 208, 0.2);
  background: ${({ $active }) =>
    $active ? 'rgba(245, 200, 75, 0.14)' : 'transparent'};
  color: ${({ $active }) => ($active ? '#e0dcd0' : '#d8d3c8')};
  box-shadow: ${({ $editing }) =>
    $editing ? 'inset 0 0 0 1px #f5c84b' : 'none'};
  font: inherit;
  font-size: 15px;
  line-height: 33px;
  text-align: left;
  white-space: nowrap;

  &:last-child {
    border-bottom: 1px solid rgba(224, 220, 208, 0.2);
  }
`;

const ControlIconFrame = styled.span<{
  $active: boolean;
}>`
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  color: ${({ $active }) => ($active ? '#f5c84b' : '#e0dcd0')};
  opacity: ${({ $active }) => ($active ? 1 : 0.85)};

  svg {
    display: block;
    width: 22px;
    height: 22px;
  }
`;

function ControlIcon({
  active,
  kind
}: {
  active: boolean;
  kind: LabIconKey;
}): JSX.Element {
  const strokeWidth = 2.1;

  return (
    <ControlIconFrame $active={active}>
      {kind === 'wifi' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.4 9.5C8.7 5.8 15.3 5.8 19.6 9.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
          <path
            d="M7.7 13C10.2 10.9 13.8 10.9 16.3 13"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
          <path
            d="M10.4 16.2C11.4 15.5 12.6 15.5 13.6 16.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
          <circle cx="12" cy="19.2" r="1.35" fill="currentColor" />
        </svg>
      )}
      {kind === 'bluetooth' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8.2 7.2L15.2 14L11 18.2V3.8L15.2 8L8.2 14.8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
      {kind === 'motor' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="8.4"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />
          <path
            d="M12 6.5V17.5M6.5 12H17.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      )}
      {kind === 'mode_up' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 19V5M6.8 10.2L12 5L17.2 10.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
      {kind === 'mode_down' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5V19M6.8 13.8L12 19L17.2 13.8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
      {kind === 'mode_ramp' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5V19M6.8 10.2L12 5L17.2 10.2M6.8 13.8L12 19L17.2 13.8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
      {kind === 'heater' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.5 5C4.8 7.2 4.8 9.2 6.5 11.4C8.2 13.6 8.2 15.8 6.5 18.2M12 5C10.3 7.2 10.3 9.2 12 11.4C13.7 13.6 13.7 15.8 12 18.2M17.5 5C15.8 7.2 15.8 9.2 17.5 11.4C19.2 13.6 19.2 15.8 17.5 18.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
      {kind === 'brightness' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="4.2"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />
          <path
            d="M12 3.5V5.2M12 18.8V20.5M20.5 12H18.8M5.2 12H3.5M18 6L16.8 7.2M7.2 16.8L6 18M18 18L16.8 16.8M7.2 7.2L6 6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
      {kind === 'lab_start' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.5 5.5L18 12L8.5 18.5V5.5Z" fill="currentColor" />
        </svg>
      )}
      {kind === 'lab_stop' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="7"
            y="7"
            width="10"
            height="10"
            rx="1.2"
            fill="currentColor"
          />
        </svg>
      )}
      {kind === 'back' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19 12H5M11 6L5 12L11 18"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </svg>
      )}
    </ControlIconFrame>
  );
}

const ControlLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ControlValue = styled.span<{ $active: boolean; $editing: boolean }>`
  color: ${({ $active, $editing }) =>
    $active || $editing ? '#f5c84b' : '#e0dcd0'};
  font-size: 14px;
  text-align: right;
`;

const TelemetryPanel = styled.div`
  position: absolute;
  top: 108px;
  left: 324px;
  width: 112px;
`;

const TelemetryDivider = styled.div`
  position: absolute;
  top: 104px;
  left: 312px;
  width: 1px;
  height: 260px;
  background: rgba(245, 200, 75, 0.28);
`;

const TelemetryTitle = styled.div`
  margin-bottom: 7px;
  color: #f5c84b;
  font-size: 14px;
  line-height: 18px;
  text-align: left;
`;

const TelemetryRow = styled.div`
  display: grid;
  grid-template-columns: 57px 1fr;
  column-gap: 6px;
  min-height: 19px;
  font-size: 12px;
  line-height: 19px;
`;

const TelemetryGroupRule = styled.div`
  width: 100%;
  height: 1px;
  margin: 5px 0;
  background: rgba(245, 200, 75, 0.28);
`;

const TelemetryLabel = styled.span`
  color: #77736c;
  white-space: nowrap;
`;

const TelemetryValue = styled.span`
  color: #e0dcd0;
  text-align: right;
  white-space: nowrap;
`;

const StatusLine = styled.div<{ $running: boolean; $busy: boolean }>`
  position: absolute;
  left: 132px;
  bottom: 48px;
  width: 216px;
  height: 24px;
  color: ${({ $busy, $running }) =>
    $busy || $running ? '#f5c84b' : '#77736c'};
  font-size: 14px;
  line-height: 24px;
  text-align: center;
`;

const nextMotorMode = (mode: MotorMode): MotorMode => {
  if (mode === 'up') return 'down';
  if (mode === 'down') return 'ramp';
  return 'up';
};

const wrapIndex = (index: number, delta: number) =>
  (index + delta + menuItems.length) % menuItems.length;

const formatNumber = (
  value: number | string | null | undefined,
  digits = 1,
  unit = ''
) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value.toFixed(digits)}${unit}`;
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return '--';
};

const readSetpoint = (setpoints: Setpoints, keys: string[]) => {
  for (const key of keys) {
    const value = setpoints[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const readTelemetryValue = (values: TelemetryValues, keys: string[]) => {
  for (const key of keys) {
    const value = values[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

export function LabCertificationMenu(): JSX.Element {
  const dispatch = useAppDispatch();
  const sensorData = useAppSelector((state) => state.stats.sensorData);
  const setpoints = useAppSelector(
    (state) => state.stats.setpoints as Setpoints
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<LabMenuKey | null>(null);
  const [wifiEnabled, setWifiEnabled] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [bandHeaterPower, setBandHeaterPower] = useState(0);
  const [motorPower, setMotorPower] = useState(0);
  const [motorMode, setMotorMode] = useState<MotorMode>('up');
  const [screenBrightness, setScreenBrightness] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getWifiRadioStatus(), getBluetoothStatus()])
      .then(([wifiRadio, bluetooth]) => {
        if (cancelled) return;
        setWifiEnabled(wifiRadio);
        setBluetoothEnabled(bluetooth.powered);
      })
      .catch((error) => console.error('Failed to load lab status', error));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      setBrightness({ brightness: 1 });
    };
  }, []);

  useEffect(() => {
    setBrightness({ brightness: screenBrightness / 100 });
  }, [screenBrightness]);

  const controls = useMemo<LabControlRow[]>(
    () => [
      {
        key: 'wifi',
        icon: 'wifi',
        label: 'WiFi',
        value: wifiEnabled ? 'ON' : 'OFF'
      },
      {
        key: 'bluetooth',
        icon: 'bluetooth',
        label: 'Bluetooth',
        value: bluetoothEnabled ? 'ON' : 'OFF'
      },
      {
        key: 'motor',
        icon: 'motor',
        label: 'Motor',
        value: `${motorPower}%`
      },
      {
        key: 'motor_mode',
        icon:
          motorMode === 'up'
            ? 'mode_up'
            : motorMode === 'down'
              ? 'mode_down'
              : 'mode_ramp',
        label: 'Motor mode',
        value: motorMode
      },
      {
        key: 'band_heater',
        icon: 'heater',
        label: 'Heater',
        value: `${bandHeaterPower}%`
      },
      {
        key: 'brightness',
        icon: 'brightness',
        label: 'Brightness',
        value: `${screenBrightness}%`
      },
      {
        key: 'run',
        icon: isRunning ? 'lab_stop' : 'lab_start',
        label: isRunning ? 'Stop lab' : 'Start lab'
      },
      {
        key: 'back',
        icon: 'back',
        label: 'Back'
      }
    ],
    [
      bandHeaterPower,
      bluetoothEnabled,
      isRunning,
      motorMode,
      motorPower,
      screenBrightness,
      wifiEnabled
    ]
  );

  const telemetry = useMemo(() => {
    const sensorValues = sensorData as unknown as TelemetryValues;
    return [
      {
        label: 'M_SET',
        value: formatNumber(
          readSetpoint(setpoints, ['motor', 'motor_power']) ??
            readTelemetryValue(sensorValues, [
              'motor_setpoint',
              'motor_power',
              'm_sp',
              'm_pwr'
            ]),
          0,
          '%'
        )
      },
      {
        label: 'H_SET',
        value: formatNumber(
          readSetpoint(setpoints, ['band_heater', 'bandheater', 'heater']) ??
            readTelemetryValue(sensorValues, [
              'heater_setpoint',
              'bandheater_setpoint',
              'bandheater_power',
              'bh_sp',
              'bh_pwr'
            ]),
          0,
          '%'
        ),
        groupEnd: true
      },
      {
        label: 'M_CUR',
        value: formatNumber(sensorData.m_cur, 2)
      },
      {
        label: 'H_CUR',
        value: formatNumber(sensorData.bh_cur, 2),
        groupEnd: true
      },
      { label: 'T_DN', value: formatNumber(sensorData.t_bar_down, 1) },
      { label: 'T_MD', value: formatNumber(sensorData.t_bar_md, 1) },
      { label: 'T_MU', value: formatNumber(sensorData.t_bar_mu, 1) },
      { label: 'T_UP', value: formatNumber(sensorData.t_bar_up, 1) },
      { label: 'T_E1', value: formatNumber(sensorData.t_ext_1, 1) },
      { label: 'T_E2', value: formatNumber(sensorData.t_ext_2, 1) }
    ] satisfies TelemetryRowItem[];
  }, [sensorData, setpoints]);

  const updatePower = (
    setter: Dispatch<SetStateAction<number>>,
    direction: 'left' | 'right'
  ) => {
    setter((current) =>
      Math.min(Math.max(current + (direction === 'right' ? 5 : -5), 0), 100)
    );
  };

  const toggleActiveControl = async () => {
    const key = menuItems[activeIndex].key;
    if (key === 'back') {
      if (isRunning) {
        setIsBusy(true);
        try {
          await stopMotorHeaterControl();
          setIsRunning(false);
        } finally {
          setIsBusy(false);
        }
      }
      await setBrightness({ brightness: 1 });
      dispatch(setScreen('ready'));
      return;
    }

    if (key === 'wifi') {
      setIsBusy(true);
      try {
        setWifiEnabled(await setWifiRadioStatus(!wifiEnabled));
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (key === 'bluetooth') {
      setIsBusy(true);
      try {
        const status = await setBluetoothPower(!bluetoothEnabled);
        setBluetoothEnabled(status.powered);
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (key === 'motor_mode') {
      setMotorMode((current) => nextMotorMode(current));
      return;
    }

    if (key === 'band_heater' || key === 'motor' || key === 'brightness') {
      setEditingKey((current) => (current === key ? null : key));
      return;
    }

    if (key === 'run') {
      setIsBusy(true);
      try {
        if (isRunning) {
          await stopMotorHeaterControl();
          setIsRunning(false);
        } else {
          await startMotorHeaterControl({
            motor_power: motorPower,
            band_heater_power: bandHeaterPower,
            motor_mode: motorMode
          });
          setIsRunning(true);
        }
      } finally {
        setIsBusy(false);
      }
    }
  };

  useHandleGestures(
    {
      left() {
        if (isBusy) return;
        if (editingKey === 'band_heater') {
          updatePower(setBandHeaterPower, 'left');
          return;
        }
        if (editingKey === 'motor') {
          updatePower(setMotorPower, 'left');
          return;
        }
        if (editingKey === 'brightness') {
          updatePower(setScreenBrightness, 'left');
          return;
        }
        setActiveIndex((prev) => wrapIndex(prev, -1));
      },
      right() {
        if (isBusy) return;
        if (editingKey === 'band_heater') {
          updatePower(setBandHeaterPower, 'right');
          return;
        }
        if (editingKey === 'motor') {
          updatePower(setMotorPower, 'right');
          return;
        }
        if (editingKey === 'brightness') {
          updatePower(setScreenBrightness, 'right');
          return;
        }
        setActiveIndex((prev) => wrapIndex(prev, 1));
      },
      pressDown() {
        if (isBusy) return;
        toggleActiveControl();
      }
    },
    false
  );

  return (
    <LabScreen>
      <CircleGuide />
      <ScreenTitle>Lab Menu</ScreenTitle>
      <ContentRule />
      <ControlList>
        {controls.map((option, index) => {
          const active = activeIndex === index;
          const editing = editingKey === option.key;
          return (
            <ControlButton
              key={option.key}
              $active={active}
              $editing={editing}
              onClick={() => setActiveIndex(index)}
            >
              <ControlIcon active={active} kind={option.icon} />
              <ControlLabel>
                {isBusy && active ? 'Working' : option.label}
              </ControlLabel>
              <ControlValue $active={active} $editing={editing}>
                {editing && option.value ? `[${option.value}]` : option.value}
              </ControlValue>
            </ControlButton>
          );
        })}
      </ControlList>
      <TelemetryDivider />
      <TelemetryPanel>
        <TelemetryTitle>FW Data</TelemetryTitle>
        {telemetry.map((item) => (
          <div key={item.label}>
            <TelemetryRow>
              <TelemetryLabel>{item.label}</TelemetryLabel>
              <TelemetryValue>{item.value}</TelemetryValue>
            </TelemetryRow>
            {item.groupEnd ? <TelemetryGroupRule /> : null}
          </div>
        ))}
      </TelemetryPanel>
      <StatusLine $running={isRunning} $busy={isBusy}>
        {isBusy ? 'Working' : isRunning ? 'Running' : 'Idle'}
      </StatusLine>
    </LabScreen>
  );
}
