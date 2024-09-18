import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

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

const items = [{ key: 'connect' }, { key: 'delete' }, { key: 'back' }];

export const DeleteWifiMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
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

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  if (deleteKnownWifiMutation.isSuccess) {
    dispatch(setBubbleDisplay({ visible: true, component: 'KnownWifi' }));
  }

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
    <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={25}
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
  );
};
