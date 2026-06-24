import { useEffect, useMemo, useState } from 'react';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import Styled, {
  MARQUEE_MIN_TEXT_LENGTH,
  VIEWPORT_HEIGHT
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
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
  hasSeparator?: boolean;
};

const menuItems: LabMenuItem[] = [
  { key: 'wifi', label: 'WiFi' },
  { key: 'bluetooth', label: 'Bluetooth' },
  { key: 'band_heater', label: 'Band heater' },
  { key: 'motor', label: 'Motor' },
  { key: 'motor_mode', label: 'Motor mode' },
  { key: 'run', label: 'Start lab mode', hasSeparator: true },
  { key: 'stop', label: 'Stop lab mode' },
  { key: 'back', label: 'Back' }
];

const nextMotorMode = (mode: MotorMode): MotorMode => {
  if (mode === 'up') return 'down';
  if (mode === 'down') return 'ramp';
  return 'up';
};

export function LabCertificationMenu(): JSX.Element {
  const dispatch = useAppDispatch();
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

  const settings = useMemo(
    () =>
      menuItems.map((item) => {
        const editing = editingKey === item.key ? '*' : '';
        switch (item.key) {
          case 'wifi':
            return {
              ...item,
              label: `${editing}WiFi: ${wifiEnabled ? 'ON' : 'OFF'}`
            };
          case 'bluetooth':
            return {
              ...item,
              label: `${editing}Bluetooth: ${bluetoothEnabled ? 'ON' : 'OFF'}`
            };
          case 'band_heater':
            return {
              ...item,
              label: `${editing}Band heater: ${bandHeaterPower}%`
            };
          case 'motor':
            return { ...item, label: `${editing}Motor: ${motorPower}%` };
          case 'motor_mode':
            return { ...item, label: `${editing}Motor mode: ${motorMode}` };
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
      editingKey,
      isRunning,
      motorMode,
      motorPower,
      wifiEnabled
    ]
  );

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
        setActiveIndex((prev) => Math.max(prev - 1, 0));
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
        setActiveIndex((prev) => Math.min(prev + 1, menuItems.length - 1));
      },
      pressDown() {
        if (isBusy) return;
        toggleActiveControl();
      }
    },
    false
  );

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings
      }),
    [activeIndex, settings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings
      }),
    [activeIndex, settings]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {settings.map((option, index) => (
            <Styled.Option
              key={option.key}
              $hasSeparator={option.hasSeparator}
              $isMarquee={
                activeIndex === index &&
                option.label.length > MARQUEE_MIN_TEXT_LENGTH
              }
            >
              <span>
                {isBusy && activeIndex === index ? 'Working' : option.label}
              </span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {settings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $hasSeparator={option.hasSeparator}
                $isMarquee={
                  activeIndex === index &&
                  option.label.length > MARQUEE_MIN_TEXT_LENGTH
                }
              >
                <span>
                  {isBusy && activeIndex === index ? 'Working' : option.label}
                </span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
}
