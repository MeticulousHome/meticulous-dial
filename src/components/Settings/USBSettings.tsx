import { useCallback, useEffect, useState } from 'react';

import { SettingsKey, USB_MODE } from '@meticulous-home/espresso-api';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { SettingsItem } from '../../types';
import { marqueeIfNeeded } from '../shared/MarqueeValue';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { MenuAnnotation } from './MenuAnnotation';

export const USBSettings = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  type StaticSettingsItem = SettingsItem & {
    useableWidthPercentage?: number;
  };

  const settings: StaticSettingsItem[] = [
    {
      key: 'client',
      label: 'Client / USB-C Network',
      useableWidthPercentage: 87
    },
    {
      key: 'host',
      label: 'Host (Charging)',
      useableWidthPercentage: 81
    },
    {
      key: 'dual_role',
      label: 'DRP (advanced only)',
      useableWidthPercentage: 77
    },
    {
      key: 'back',
      label: 'Back'
    }
  ];

  useEffect(() => {
    if (globalSettings) {
      const index = settings.findIndex(
        (setting) => setting.key === globalSettings.usb_mode
      );
      setActiveIndex(index);
    }
  }, [globalSettings.usb_mode]);

  const showValue = useCallback(
    (isActive: boolean, item: StaticSettingsItem) => {
      if (!item) return <></>;
      let val = item.label.toUpperCase();
      if (globalSettings) {
        if (typeof globalSettings[item.key as SettingsKey] === 'boolean') {
          val = globalSettings[item.key as SettingsKey]
            ? val + ': ENABLED'
            : val + ': DISABLED';
        }

        return marqueeIfNeeded({
          enabled: isActive,
          val,
          len: 18,
          forceWidth: item.useableWidthPercentage + '%'
        });
      }
    },

    [globalSettings]
  );

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
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
            break;
          default: {
            updateSettings.mutate({
              usb_mode: activeItem as USB_MODE
            });
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible
  );

  return (
    <div className="main-quick-settings settings-explanation-container">
      <div className="settings-explanation">
        <div className="settings-explanation-shaper-left" />
        <div className="settings-explanation-shaper-right" />
        <span>
          Use <strong>Client</strong> Mode to connect to the machine directly
          via USB-C.
          <br />A USB-C dongle is required to charge a connected Device when in{' '}
          <strong>Client</strong> mode.
        </span>
        <div style={{ marginTop: '10px' }}>
          <span>
            Devices which only support <b>client</b> mode (such as USB flash
            drives) will only work when the machine is set to{' '}
            <strong>Host</strong>.
          </span>
        </div>
      </div>
      <div
        className="settings-fixed-item-container"
        style={{ marginBottom: '50px' }}
      >
        {settings.map((item, index: number) => {
          const isActive = index === activeIndex;
          const isSelectedMode = globalSettings?.usb_mode === item.key;
          console.log(globalSettings?.usb_mode, item.key);
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
              <span className="settings-fixed-item-text ">
                {showValue(isActive, item)}
              </span>
              {isSelectedMode && (
                <MenuAnnotation style={{ marginLeft: 10 }}>
                  current
                </MenuAnnotation>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
