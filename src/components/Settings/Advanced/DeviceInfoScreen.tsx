import { useMemo, useState } from 'react';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setBubbleDisplay } from '../../store/features/screens/screens-slice';
import { useDeviceInfo } from '../../../hooks/useDeviceOSStatus';
import { DeviceInfo } from '@meticulous-home/espresso-api';
import { LoadingScreen } from '../../LoadingScreen/LoadingScreen';

import Styled, {
  VIEWPORT_HEIGHT,
  MARQUEE_MIN_TEXT_LENGTH
} from '../../../styles/utils/mixins';
import { calculateOptionPosition } from '../../../styles/utils/calculateOptionPosition';

interface RepositoryEntry {
  branch: string;
  commit: string;
}

interface RepositoryInfo {
  [key: string]: RepositoryEntry;
}

interface ExtendedDeviceInfo extends DeviceInfo {
  mainVoltage: number;
  batch_number: string;
  build_date: string;
  image_build_channel: string;
  repository_info: RepositoryInfo;
}

export const DeviceInfoScreen = () => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const { data: deviceInfo, isLoading } = useDeviceInfo();

  const updatedDeviceInfo = useMemo(() => {
    if (!deviceInfo || isLoading) return [];

    const { repository_info, ...basicData } = deviceInfo as ExtendedDeviceInfo;

    const basicInfo = Object.entries(basicData).map(([key, value]) => ({
      key,
      label: `${key}: ${value || 'UNSET'}`
    }));

    const keysToFilter = ['backend', 'dial', 'firmware'];

    const repositoryInfo = repository_info
      ? Object.entries(repository_info)
          .filter(([key]) => keysToFilter.includes(key))
          .map(([key, { branch, commit }]) => {
            const [commitHash, comment] = commit.split('-');
            const slicedComment =
              comment.length > 20 ? comment.slice(0, 20) : comment;
            return {
              key,
              label: `${key}: ${branch} (${commitHash.trim()} - ${slicedComment}...)`
            };
          })
      : [];

    return [
      ...basicInfo,
      ...repositoryInfo,
      ...[{ key: 'back', label: 'Back' }]
    ];
  }, [deviceInfo, isLoading]);

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) =>
          Math.min(prev + 1, updatedDeviceInfo.length - 1)
        );
      },
      pressDown() {
        const activeItem = updatedDeviceInfo[activeIndex].key;
        switch (activeItem) {
          case 'back':
            dispatch(
              setBubbleDisplay({ visible: true, component: 'settings' })
            );
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
        settings: updatedDeviceInfo
      }),
    [activeIndex, updatedDeviceInfo]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: updatedDeviceInfo
      }),
    [activeIndex, updatedDeviceInfo]
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {updatedDeviceInfo.map((option) => (
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
            {updatedDeviceInfo.map((option, index) => (
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
