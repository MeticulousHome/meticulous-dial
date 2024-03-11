import { useCallback, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import Marquee from 'react-fast-marquee';

import './settings.css';
import '../PressetSettings/pressetSettings.css';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { QuickSettings } from '../QuickSettings/QuickSettings';
import { updateSettings } from '../store/features/settings/settings-slice';

interface ISettings {
  key: string;
  label: string;
  value?: boolean | string;
  visible: boolean;
}

let settings: ISettings[] = [
  {
    key: 'save',
    label: 'save',
    value: null,
    visible: true
  },
  {
    key: 'back',
    label: 'back',
    value: null,
    visible: true
  }
];

function showValue(item: Record<string, any>) {
  let val = item.value;
  if (item.type === 'boolean') {
    val = val ? ' ENABLED' : ' DISABLED';
  }

  if (item.type === 'string') val = ` ${val}`;

  if (item.label.length > 15) {
    return <Marquee delay={0.6}>{val}</Marquee>;
  }

  return <span>{val}</span>;
}

export function Settings(): JSX.Element {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const globalSettings = useAppSelector((state) => state.settings);

  useEffect(() => {
    const entries = Object.entries(globalSettings || {});
    if (entries.length > 0) {
      const items = entries.map((item: any) => {
        const [key, obj] = item;
        return {
          key,
          label: key.split('_').join(' '),
          value: obj['value'],
          type: obj['type'],
          visible: obj['visible']
        };
      });

      if (items.length > 0) settings.unshift(...items);
      settings = settings.filter((item) => item.visible);
    }
  }, [globalSettings]);

  useEffect(() => {
    return () => {
      settings = [
        {
          key: 'save',
          label: 'save',
          value: null,
          visible: true
        },
        {
          key: 'back',
          label: 'back',
          value: null,
          visible: true
        }
      ];
    };
  }, []);

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, settings.length - 1));
    },
    click() {
      switch (settings[activeIndex].key) {
        case 'save': {
          const itemsToSave = settings
            .filter((item) => item.value !== null)
            .map((item) => {
              return {
                [item.key]: item.value
              };
            });

          if (itemsToSave) {
            const body = Object.assign({}, ...itemsToSave);
            dispatch(updateSettings(body));
            dispatch(
              setBubbleDisplay({ visible: true, component: QuickSettings })
            );
          }
          break;
        }
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: QuickSettings })
          );
          break;
        default: {
          if (typeof settings[activeIndex].value === 'boolean') {
            settings[activeIndex].value = !settings[activeIndex].value;
          }
          break;
        }
      }
    }
  });

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

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
        {settings.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <SwiperSlide
              key={item.key}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
            >
              <div style={{ height: '30px' }}>
                <div className="settings-entry">
                  {item.label}
                  {item.value !== null ? ':' : ''}&nbsp;
                  <span
                    className="settings-text"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {showValue(item)}
                  </span>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
