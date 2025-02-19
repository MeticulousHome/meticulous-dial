import { useMemo, useState } from 'react';
import { startMasterCalibration } from '../../../api/api';

import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { SettingsItem } from '../../../types';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';
import { IdleScreens } from '../../../components/Settings/Advanced/IdleScreenSetting';

const initialSettings: SettingsItem[] = [
  {
    key: 'usb_mode',
    label: 'USB mode',
    getLabel: (settings) => settings.usb_mode
  },
  {
    key: 'master_calibration',
    label: 'ACAIA master calibration',
    visible: true
  },
  {
    key: 'save_debug_shot_data',
    label: 'Save debug shot data',
    getLabel: (settings) =>
      `${settings.save_debug_shot_data ? 'ENABLED' : 'DISABLED'}`,
    visible: true
  },
  {
    key: 'set_update_channel',
    label: 'Update channel',
    getLabel: (settings) => settings.update_channel,
    visible: true
  },
  {
    key: 'idle_screen',
    label: 'Select Idle Screen',
    getLabel: (settings) =>
      IdleScreens.find((item) => item.key === settings.idle_screen)?.shortLabel,
    visible: true
  },
  {
    key: 'back',
    label: 'Back',
    visible: true
  }
];

export const AdvancedSettings = () => {
  const dispatch = useAppDispatch();
  const { data: globalSettings, isSuccess } = useSettings();
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const { refetch: fetchDeviceStatus } = useDeviceInfo();

  const updatedSettings = useMemo(() => {
    if (!isSuccess) {
      return initialSettings.map((item) => ({
        ...item
      }));
    }
    return initialSettings.map((item) => ({
      ...item,
      label: item.getLabel
        ? `${item.label}: ${item.getLabel(globalSettings)}`
        : item.label
    }));
  }, [globalSettings, isSuccess]);

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, updatedSettings.length - 1)
        );
      },
      pressDown() {
        const activeItem = updatedSettings[activeIndex].key;
        switch (activeItem) {
          case 'device_info':
            fetchDeviceStatus();
            dispatch(
              setBubbleDisplay({ visible: true, component: 'deviceInfo' })
            );
            break;
          case 'usb_mode': {
            dispatch(
              setBubbleDisplay({ visible: true, component: 'usbSettings' })
            );
            break;
          }
          case 'save_debug_shot_data':
            updateSettings.mutate({
              save_debug_shot_data: !globalSettings.save_debug_shot_data
            });
            break;
          case 'set_update_channel':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'updateChannel' })
            );
            break;
          case 'idle_screen':
            dispatch(
              setBubbleDisplay({
                visible: true,
                component: 'idleScreenSettings'
              })
            );
            break;

          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
            break;
          case 'master_calibration':
            startMasterCalibration()
              .then(() => {
                dispatch(setBubbleDisplay({ visible: false, component: null }));
              })
              .catch((err) => {
                console.log(err);
              });
            break;
          default: {
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible
  );

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: updatedSettings
      }),
    [activeIndex, updatedSettings]
  );

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {updatedSettings.map((option) => (
            <Styled.Option key={option.key}>
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {updatedSettings.map((option, index) => (
              <Styled.Option
                key={option.key}
                $isMarquee={
                  activeIndex === index &&
                  option.label.length > MARQUEE_MIN_TEXT_LENGTH
                }
              >
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
