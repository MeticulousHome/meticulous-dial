import { useEffect, useMemo, useState } from 'react';
import { styled } from 'styled-components';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
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
  | 'motor'
  | 'motor_mode'
  | 'run'
  | 'stop'
  | 'back';

type LabMenuItem = {
  key: LabMenuKey;
  label: string;
};

type Setpoints = Record<string, number | string | null | undefined>;
type TelemetryValues = Record<string, number | string | null | undefined>;

const menuItems: LabMenuItem[] = [
  { key: 'wifi', label: 'WiFi' },
  { key: 'bluetooth', label: 'Bluetooth' },
  { key: 'band_heater', label: 'Band heater' },
  { key: 'motor', label: 'Motor' },
  { key: 'motor_mode', label: 'Motor mode' },
  { key: 'run', label: 'Start lab mode' },
  { key: 'stop', label: 'Stop lab mode' },
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

const ControlList = styled.div`
  position: absolute;
  top: 92px;
  left: 50px;
  width: 178px;
`;

const ControlButton = styled.button<{
  $active: boolean;
  $separated: boolean;
}>`
  display: block;
  width: 100%;
  height: 34px;
  margin: ${({ $separated }) => ($separated ? '12px 0 0' : '0 0 5px')};
  padding: 0 10px;
  border: 0;
  border-radius: 17px;
  background: ${({ $active }) => ($active ? '#f5c84b' : 'transparent')};
  color: ${({ $active }) => ($active ? '#000' : '#77736c')};
  font: inherit;
  font-size: 13px;
  line-height: 34px;
  text-align: left;
  white-space: nowrap;
`;

const EditMarker = styled.span`
  display: inline-block;
  width: 10px;
`;

const TelemetryPanel = styled.div`
  position: absolute;
  top: 92px;
  right: 54px;
  width: 170px;
`;

const TelemetryTitle = styled.div`
  margin-bottom: 8px;
  color: #f5c84b;
  font-size: 13px;
  line-height: 17px;
  text-align: center;
`;

const TelemetryRow = styled.div`
  display: grid;
  grid-template-columns: max-content max-content;
  column-gap: 10px;
  justify-content: start;
  min-height: 22px;
  font-size: 13px;
  line-height: 22px;
`;

const TelemetryLabel = styled.span`
  color: #77736c;
  white-space: nowrap;
`;

const TelemetryValue = styled.span`
  color: #e0dcd0;
  text-align: left;
  white-space: nowrap;
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

  const controls = useMemo(
    () =>
      menuItems.map((item) => {
        switch (item.key) {
          case 'wifi':
            return {
              ...item,
              label: `WiFi: ${wifiEnabled ? 'ON' : 'OFF'}`
            };
          case 'bluetooth':
            return {
              ...item,
              label: `Bluetooth: ${bluetoothEnabled ? 'ON' : 'OFF'}`
            };
          case 'band_heater':
            return {
              ...item,
              label: `Band heater: ${bandHeaterPower}%`
            };
          case 'motor':
            return { ...item, label: `Motor: ${motorPower}%` };
          case 'motor_mode':
            return { ...item, label: `Motor mode: ${motorMode}` };
          case 'run':
            return {
              ...item,
              label: isRunning ? 'Lab mode running' : item.label
            };
          default:
            return item;
        }
      }),
    [
      bandHeaterPower,
      bluetoothEnabled,
      isRunning,
      motorMode,
      motorPower,
      wifiEnabled
    ]
  );

  const telemetry = useMemo(() => {
    const sensorValues = sensorData as unknown as TelemetryValues;
    return [
      {
        label: 'motor_set',
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
        label: 'heater_set',
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
        )
      },
      { label: 't_down', value: formatNumber(sensorData.t_bar_down, 1) },
      { label: 't_mid_down', value: formatNumber(sensorData.t_bar_md, 1) },
      { label: 't_mid_up', value: formatNumber(sensorData.t_bar_mu, 1) },
      { label: 't_up', value: formatNumber(sensorData.t_bar_up, 1) },
      { label: 't_ext_1', value: formatNumber(sensorData.t_ext_1, 1) },
      { label: 't_ext_2', value: formatNumber(sensorData.t_ext_2, 1) },
      { label: 'motor_cur', value: formatNumber(sensorData.m_cur, 2) },
      { label: 'heater_cur', value: formatNumber(sensorData.bh_cur, 2) }
    ];
  }, [sensorData, setpoints]);

  const updatePower = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    direction: 'left' | 'right'
  ) => {
    setter((current) =>
      Math.min(Math.max(current + (direction === 'right' ? 5 : -5), 0), 100)
    );
  };

  const toggleActiveControl = async () => {
    const key = menuItems[activeIndex].key;
    if (key === 'back') {
      dispatch(setScreen('settings'));
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

    if (key === 'band_heater' || key === 'motor') {
      setEditingKey((current) => (current === key ? null : key));
      return;
    }

    if (key === 'run') {
      setIsBusy(true);
      try {
        await startMotorHeaterControl({
          motor_power: motorPower,
          band_heater_power: bandHeaterPower,
          motor_mode: motorMode
        });
        setIsRunning(true);
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (key === 'stop') {
      setIsBusy(true);
      try {
        await stopMotorHeaterControl();
        setIsRunning(false);
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
      <ControlList>
        {controls.map((option, index) => {
          const active = activeIndex === index;
          const editing = editingKey === option.key;
          return (
            <ControlButton
              key={option.key}
              $active={active}
              $separated={option.key === 'run'}
              onClick={() => setActiveIndex(index)}
            >
              <EditMarker>{editing ? '*' : ''}</EditMarker>
              {isBusy && active ? 'Working' : option.label}
            </ControlButton>
          );
        })}
      </ControlList>
      <TelemetryPanel>
        <TelemetryTitle>Firmware data</TelemetryTitle>
        {telemetry.map((item) => (
          <TelemetryRow key={item.label}>
            <TelemetryLabel>{item.label}</TelemetryLabel>
            <TelemetryValue>{item.value}</TelemetryValue>
          </TelemetryRow>
        ))}
      </TelemetryPanel>
    </LabScreen>
  );
}
