import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  getConfig as getWifiConfig,
  getWifis
} from '../store/features/wifi/wifi-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { WifiIcon } from './WifiIcon';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';

export const KnownWifi = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { pending, knownWifis = [] } = useAppSelector((state) => state.wifi);

  console.log('knownWifis', knownWifis);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, knownWifis.length));
    },
    pressDown() {
      if (activeIndex >= knownWifis.length) {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'wifiSettings' })
        );
      } else {
        dispatch(setBubbleDisplay({ visible: false, component: null }));
      }
    }
  });

  useEffect(() => {
    dispatch(getWifiConfig());
    dispatch(getWifis());
  }, []);

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  if (pending) {
    return <LoadingScreen />;
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
        {knownWifis.length > 0 &&
          knownWifis.map((network, index) => {
            const isActive = index === activeIndex;
            return (
              <SwiperSlide
                key={network}
                className={`settings-item ${isActive ? 'active-setting' : ''}`}
              >
                <div className="network-option">
                  <span>{network}</span>
                  <WifiIcon level={Math.min(knownWifis.length - index, 4)} />
                </div>
              </SwiperSlide>
            );
          })}
        <SwiperSlide
          key="back"
          className={`settings-item ${
            activeIndex >= knownWifis.length ? 'active-setting' : ''
          }`}
          style={{ height: '30px' }}
        >
          <div>Back</div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};
