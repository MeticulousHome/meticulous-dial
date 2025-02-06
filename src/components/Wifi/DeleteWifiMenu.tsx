import { useMemo, useState } from 'react';

import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { selectWifi } from '../store/features/wifi/wifi-slice';
import { useDeleteKnownWiFi } from '../../hooks/useWifi';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

import './wifiResult.css';
import { useQueryClient } from '@tanstack/react-query';
import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

const items = [
  { key: 'connect', label: 'connect' },
  { key: 'delete', label: 'delete' },
  { key: 'back', label: 'back' }
];

export const DeleteWifiMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);
  const { selectedWifiToDelete } = useAppSelector((state) => state.wifi);
  const queryClient = useQueryClient();
  const deleteKnownWifiMutation = useDeleteKnownWiFi(queryClient);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      if (deleteKnownWifiMutation.isError) {
        dispatch(setBubbleDisplay({ visible: true, component: 'KnownWifi' }));
        return;
      }
      switch (items[activeIndex].key) {
        case 'connect': {
          dispatch(setBubbleDisplay({ visible: false, component: null }));
          dispatch(selectWifi(selectedWifiToDelete));
          dispatch(setScreen('enterWifiPassword'));
          break;
        }
        case 'delete': {
          deleteKnownWifiMutation.mutate(selectedWifiToDelete);
          break;
        }
        case 'back': {
          dispatch(setBubbleDisplay({ visible: true, component: 'KnownWifi' }));
          break;
        }
        default:
          break;
      }
    }
  });

  if (deleteKnownWifiMutation.isSuccess) {
    dispatch(setBubbleDisplay({ visible: true, component: 'KnownWifi' }));
  }

  const optionPositionOutter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        settings: items
      }),
    [activeIndex, items]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: items
      }),
    [activeIndex, items]
  );

  if (deleteKnownWifiMutation.isPending) {
    return <LoadingScreen />;
  }

  if (deleteKnownWifiMutation.isError) {
    return (
      <div className="main-container response">
        <div className={`connect-response error-entry`}>
          An error occured. Please try again
        </div>
        <div className={`connect-response error-entry`}>
          {deleteKnownWifiMutation.failureReason.message}
        </div>
        <br />
        <div key="back" className={`settings-item active-setting connect-item`}>
          <div className="settings-entry connect-button">Ok</div>
        </div>
      </div>
    );
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOutter}>
          {items.map((option) => (
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
            {items.map((option) => (
              <Styled.Option key={option.key}>
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};

/**
 * <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={16}
        autoHeight={false}
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        <SwiperSlide
          key="connect"
          className={`settings-item ${
            items[activeIndex].key === 'connect' ? 'active-setting' : ''
          }`}
        >
          <div>Connect</div>
        </SwiperSlide>
        <SwiperSlide
          key="delete"
          className={`settings-item ${
            items[activeIndex].key === 'delete' ? 'active-setting' : ''
          }`}
        >
          <div>Delete</div>
        </SwiperSlide>
        <SwiperSlide
          key="back"
          className={`settings-item ${
            items[activeIndex].key === 'back' ? 'active-setting' : ''
          }`}
        >
          <div style={{ height: '30px' }}>Back</div>
        </SwiperSlide>
      </Swiper>
    </div>

    <Styled.OptionsContainer $translateY={optionPositionOutter}>
            {items.map((option) => (
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
              {items.map((option) => (
                <Styled.Option key={option.key}>
                  <span>{option.label}</span>
                </Styled.Option>
              ))}
            </Styled.OptionsContainer>
          </Styled.ActiveIndicator>
 */
