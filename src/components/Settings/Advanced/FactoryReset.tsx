import { useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useFactoryReset } from '../../../hooks/useMachine';
import { LoadingScreen } from '../../../components/LoadingScreen/LoadingScreen';
import { SettingsItem } from '../../../types';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import { CircleKeyboard } from '../../CircleKeyboard/CircleKeyboard';

export type StaticSettingsItem = SettingsItem & {
  useableWidthPercentage?: number;
};

export const FactoryReset = () => {
  const dispatch = useAppDispatch();
  const factoryReset = useFactoryReset();
  const [activeIndex, setActiveIndex] = useState(1);
  const [serialInput, setSerialInput] = useState('');
  const [serialRejected, setSerialRejected] = useState(false);
  const [isSerialPromptOpen, setIsSerialPromptOpen] = useState(false);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { data: deviceInfo, isPending: deviceInfoPending } = useDeviceInfo();
  const deviceSerial = String(deviceInfo?.serial ?? '').trim();

  const settings: StaticSettingsItem[] = [
    {
      key: 'factory_reset',
      label: '!! Factory reset !!',
      visible: true,
      useableWidthPercentage: 81
    },
    {
      key: 'back3',
      label: 'Back',
      visible: true,
      useableWidthPercentage: 81
    }
  ];

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
      },
      pressDown() {
        const activeItem = settings[activeIndex].key;
        switch (activeItem) {
          case 'factory_reset':
            setSerialInput('');
            setSerialRejected(false);
            setIsSerialPromptOpen(true);
            break;
          default:
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
        }
      }
    },
    isSerialPromptOpen || !bubbleDisplay.interceptsGesture
  );

  if (
    factoryReset.isPending ||
    factoryReset.isSuccess ||
    (isSerialPromptOpen && deviceInfoPending)
  ) {
    return <LoadingScreen />;
  }

  const closeSerialPrompt = () => {
    setSerialInput('');
    setSerialRejected(false);
    setIsSerialPromptOpen(false);
  };

  if (isSerialPromptOpen) {
    const unlockTitle = serialRejected
      ? 'Serial does not match'
      : 'Enter Serial Number';

    return (
      <CircleKeyboard
        name={unlockTitle}
        defaultValue={serialInput.split('')}
        onSubmit={(input: string) => {
          if (
            deviceSerial.length > 0 &&
            input.trim().toLowerCase() === deviceSerial.toLowerCase()
          ) {
            setSerialRejected(false);
            factoryReset.mutate();
            return;
          }

          setSerialRejected(true);
          setSerialInput('');
        }}
        onCancel={closeSerialPrompt}
        onChange={(input: string) => {
          setSerialInput(input);
          setSerialRejected(false);
        }}
        shouldIgnoreGesture={!bubbleDisplay.interceptsGesture}
      />
    );
  }

  return (
    <div className="main-quick-settings settings-explanation-container">
      <div className="settings-explanation">
        <div className="settings-explanation-shaper-left" />
        <div className="settings-explanation-shaper-right" />
        <div style={{ marginTop: '10px' }}>
          <span>
            <strong>WARNING</strong>
            <br />
          </span>
          <div style={{ marginTop: '10px' }}>
            <span>
              <strong>This operation cannot be undone</strong> <br />
              Before continuing make sure to do the following:
            </span>
          </div>

          <div style={{ marginTop: '10px' }}>
            <span>
              • Back up your profiles
              <br /> • Back up the machine Logs
            </span>
          </div>

          <div style={{ marginTop: '10px' }}>
            <span>
              If You are experiencing any kind of issue please reach out to{' '}
              <b>Customer Support</b> first
            </span>
          </div>
        </div>
      </div>
      <div
        className="settings-fixed-item-container"
        style={{ marginBottom: '50px' }}
      >
        {settings.map((item, index: number) => {
          const isActive = index === activeIndex;
          const width = item.useableWidthPercentage || 90;
          return (
            <div
              key={index}
              className={`settings-fixed-item  settings-item ${isActive ? 'active-setting' : ''}`}
              style={{
                marginBottom: '5px',
                width: `${width}%`,
                paddingRight: `${90 - width}%`
              }}
            >
              <span className="settings-fixed-item-text">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
