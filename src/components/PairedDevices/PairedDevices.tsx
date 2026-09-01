import { useMemo, useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { selectPairedDevice } from '../store/features/pairing/pairing-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { usePairedDevices } from '../../hooks/usePairedDevices';
import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

export const PairedDevices = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data, isLoading } = usePairedDevices();

  const devices = useMemo(() => {
    const deviceItems = (data ?? []).map((device) => ({
      key: device.device_id,
      label: device.device_name
    }));
    if (deviceItems.length === 0) {
      return [
        { key: 'empty', label: 'No paired devices' },
        { key: 'back', label: 'Back' }
      ];
    }
    // Offer "Remove all" only when it saves work (more than one device).
    const tail =
      deviceItems.length > 1
        ? [
            { key: 'remove-all', label: 'Remove all' },
            { key: 'back', label: 'Back' }
          ]
        : [{ key: 'back', label: 'Back' }];
    return [...deviceItems, ...tail];
  }, [data]);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, devices.length - 1));
    },
    pressDown() {
      const activeItem = devices[activeIndex];
      if (activeItem.key === 'back') {
        dispatch(setBubbleDisplay({ visible: true, component: 'settings' }));
      } else if (activeItem.key === 'remove-all') {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'revokeAllConfirmMenu' })
        );
      } else if (activeItem.key !== 'empty') {
        dispatch(
          selectPairedDevice({
            deviceId: activeItem.key,
            deviceName: activeItem.label
          })
        );
        dispatch(
          setBubbleDisplay({ visible: true, component: 'revokeDeviceMenu' })
        );
      }
    }
  });

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: devices
      }),
    [activeIndex, devices]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: devices
      }),
    [activeIndex, devices]
  );
  if (isLoading) {
    return <LoadingScreen />;
  }
  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {devices.map((option) => (
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
            {devices.map((option, index) => (
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
