import { useState } from 'react';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useFactoryReset } from '../../../hooks/useMachine';
import { LoadingScreen } from '../../../components/LoadingScreen/LoadingScreen';
import { StaticSettingsItem } from '../USBSettings';
import { marqueeIfNeeded } from '../../shared/MarqueeValue';

export const FactoryReset = () => {
  const dispatch = useAppDispatch();
  const factoryReset = useFactoryReset();
  const [activeIndex, setActiveIndex] = useState(1);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

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
            factoryReset.mutate();
            break;
          default:
            dispatch(
              setBubbleDisplay({ visible: true, component: 'advancedSettings' })
            );
            break;
        }
      }
    },
    !bubbleDisplay.interceptsGesture
  );

  const showValue = (isActive: boolean, item: StaticSettingsItem) => {
    if (!item) return <></>;
    const val = item.label.toUpperCase();
    return marqueeIfNeeded({
      enabled: isActive,
      val,
      len: 18,
      forceWidth: item.useableWidthPercentage + '%'
    });
  };

  if (factoryReset.isPending || factoryReset.isSuccess) {
    return <LoadingScreen />;
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
              <span className="settings-fixed-item-text">
                {showValue(isActive, item)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
