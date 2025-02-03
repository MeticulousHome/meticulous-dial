import { useEffect, useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import { useAppDispatch } from '../store/hooks';
import { selectWifiToDelete } from '../store/features/wifi/wifi-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { WifiIcon } from './WifiIcon';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { useNetworkConfig } from '../../hooks/useWifi';

export const KnownWifi = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { data, isLoading } = useNetworkConfig();

  const knownWifis = useMemo(() => {
    if (!data?.known_wifis) {
      return [];
    }

    return Object.keys(data?.known_wifis).map((key: string) => ({
      password: data.known_wifis[key],
      ssid: key
    })) as { password: string; ssid: string }[];
  }, [data]);

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
        dispatch(selectWifiToDelete(knownWifis[activeIndex].ssid));
        dispatch(
          setBubbleDisplay({ visible: true, component: 'deleteKnowWifiMenu' })
        );
      }
    }
  });

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="main-quick-settings">
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
        {knownWifis.length > 0 &&
          knownWifis.map((network, index) => {
            const isActive = index === activeIndex;
            return (
              <SwiperSlide
                key={network.ssid}
                className={`settings-item ${isActive ? 'active-setting' : ''}`}
              >
                <div className="network-option">
                  <span>{network.ssid}</span>
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
