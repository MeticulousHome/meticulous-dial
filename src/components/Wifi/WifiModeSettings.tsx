import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { APMode } from '@meticulous-home/espresso-api';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  NETWORK_CONFIG_QUERY_KEY,
  useNetworkConfig,
  useUpdateNetworkConfig
} from '../../hooks/useWifi';
import Styled, {
  MARQUEE_MIN_TEXT_LENGTH,
  MenuAnnotation,
  VIEWPORT_HEIGHT
} from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

type WifiModeItem = {
  key: string;
  label: string;
  mode?: APMode;
  hasSeparator?: boolean;
};

const wifiModeItems: WifiModeItem[] = [
  {
    key: 'client',
    label: 'Join existing WiFi',
    mode: APMode.CLIENT
  },
  {
    key: 'standalone',
    label: 'Create standalone WiFi',
    mode: APMode.AP,
    hasSeparator: true
  },
  {
    key: 'save',
    label: 'Save'
  },
  {
    key: 'cancel',
    label: 'Cancel'
  }
];

const getLoadingMessages = (mode: APMode | null): string[] => {
  if (mode === APMode.AP) {
    return [
      'Starting hotspot',
      'Trying WiFi channels',
      'Checking hotspot',
      'Keeping current WiFi safe'
    ];
  }

  if (mode === APMode.CLIENT) {
    return ['Joining WiFi mode', 'Checking connection', 'Updating WiFi'];
  }

  return ['Updating WiFi'];
};

export const WifiModeSettings = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [activeIndex, setActiveIndex] = useState(0);
  const [draftMode, setDraftMode] = useState<APMode | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const { data: networkConfig, error, isLoading } = useNetworkConfig();
  const updateNetworkConfigMutation = useUpdateNetworkConfig();
  const currentMode = networkConfig?.config.mode;
  const loadingMessages = useMemo(
    () => getLoadingMessages(draftMode),
    [draftMode]
  );

  useEffect(() => {
    if (draftMode !== null || !currentMode) {
      return;
    }

    setDraftMode(currentMode);
    setActiveIndex(currentMode === APMode.AP ? 1 : 0);
  }, [currentMode, draftMode]);

  useEffect(() => {
    setLoadingMessageIndex(0);

    if (!updateNetworkConfigMutation.isPending || loadingMessages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex(
        (current) => (current + 1) % loadingMessages.length
      );
    }, 7000);

    return () => clearInterval(interval);
  }, [loadingMessages, updateNetworkConfigMutation.isPending]);

  const returnToWifiSettings = () => {
    dispatch(setBubbleDisplay({ visible: true, component: 'wifiSettings' }));
  };

  useHandleGestures(
    {
      left() {
        setActiveIndex((previous) => Math.max(previous - 1, 0));
      },
      right() {
        setActiveIndex((previous) =>
          Math.min(previous + 1, wifiModeItems.length - 1)
        );
      },
      pressDown() {
        if (updateNetworkConfigMutation.isError || error) {
          updateNetworkConfigMutation.reset();
          returnToWifiSettings();
          return;
        }

        const activeItem = wifiModeItems[activeIndex];
        if (activeItem.mode) {
          setDraftMode(activeItem.mode);
          return;
        }

        if (activeItem.key === 'cancel') {
          returnToWifiSettings();
          return;
        }

        if (activeItem.key !== 'save' || !draftMode) {
          return;
        }

        if (draftMode === currentMode) {
          returnToWifiSettings();
          return;
        }

        void queryClient.cancelQueries({
          queryKey: [NETWORK_CONFIG_QUERY_KEY]
        });
        updateNetworkConfigMutation.mutate(
          {
            ...networkConfig?.config,
            mode: draftMode
          },
          {
            onSuccess: (updatedConfig) => {
              queryClient.setQueryData(
                [NETWORK_CONFIG_QUERY_KEY],
                (current: typeof networkConfig) =>
                  current
                    ? {
                        ...current,
                        config: {
                          ...current.config,
                          ...updatedConfig
                        }
                      }
                    : current
              );
              returnToWifiSettings();
            }
          }
        );
      }
    },
    !bubbleDisplay.interceptsGesture ||
      isLoading ||
      updateNetworkConfigMutation.isPending
  );

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: wifiModeItems
      }),
    [activeIndex]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: wifiModeItems
      }),
    [activeIndex]
  );

  if (isLoading) {
    return <LoadingScreen message="Loading WiFi mode" />;
  }

  if (updateNetworkConfigMutation.isPending) {
    return <LoadingScreen message={loadingMessages[loadingMessageIndex]} />;
  }

  if (updateNetworkConfigMutation.isError || error) {
    const title = updateNetworkConfigMutation.isError
      ? 'Could not update WiFi'
      : 'Could not load WiFi mode';
    const message = updateNetworkConfigMutation.isError
      ? updateNetworkConfigMutation.error?.message ||
        'Could not update WiFi. Please try again.'
      : 'Could not load the current WiFi mode. Please try again.';

    return (
      <div className="main-container response">
        <div className="connect-response-title error-entry">{title}</div>
        <div className="connect-response-message error-entry">{message}</div>
        <div key="back" className="settings-item active-setting connect-item">
          <div className="settings-entry connect-button">Ok</div>
        </div>
      </div>
    );
  }

  const getAnnotation = (item: WifiModeItem): 'current' | 'selected' | null => {
    if (!item.mode) {
      return null;
    }

    if (draftMode !== currentMode && item.mode === draftMode) {
      return 'selected';
    }

    return item.mode === currentMode ? 'current' : null;
  };

  const renderOption = (
    option: WifiModeItem,
    index: number,
    isInner: boolean
  ) => {
    const annotation = getAnnotation(option);

    return (
      <Styled.SelectedOption
        key={option.key}
        $hasSeparator={option.hasSeparator}
        $isMarquee={
          activeIndex === index && option.label.length > MARQUEE_MIN_TEXT_LENGTH
        }
      >
        <span>{option.label}</span>
        {annotation && (
          <MenuAnnotation $marginRigth={isInner ? undefined : '1.2rem'}>
            {annotation}
          </MenuAnnotation>
        )}
      </Styled.SelectedOption>
    );
  };

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {wifiModeItems.map((option, index) =>
            renderOption(option, index, false)
          )}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {wifiModeItems.map((option, index) =>
              renderOption(option, index, true)
            )}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
