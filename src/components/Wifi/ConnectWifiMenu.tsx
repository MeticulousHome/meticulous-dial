import { useMemo, useState } from 'react';

import './connectWifiMenu.css';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';

const items = [
  { key: 'connect-via-app', label: 'Connect via APP' },
  { key: 'choose-wifi', label: 'Connect to a network' },
  { key: 'back', label: 'Back' }
];

export const ConnectWifiMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [activeIndex, setActiveIndex] = useState(0);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      switch (items[activeIndex].key) {
        case 'connect-via-app': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'connectWifiViaApp' })
          );
          break;
        }
        case 'choose-wifi': {
          dispatch(
            setBubbleDisplay({ visible: true, component: 'selectWifi' })
          );
          break;
        }
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: 'wifiSettings' })
          );
          break;

        default:
          break;
      }
    }
  });

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

/*  <div className="main-quick-settings">
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
          key="connect-via-app"
          className={`settings-item ${
            items[activeIndex].key === 'connect-via-app' ? 'active-setting' : ''
          }`}
        >
          <div>Connect via APP</div>
        </SwiperSlide>
        <SwiperSlide
          key="choose-wifi"
          className={`settings-item ${
            items[activeIndex].key === 'choose-wifi' ? 'active-setting' : ''
          }`}
        >
          <div>Connect to a network</div>
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
    </div> */
