import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

import './TestOptions.css';
import { useHandleGestures } from '../../../hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setBubbleDisplay,
  setScreen
} from '../../store/features/screens/screens-slice';
import { Gauge } from '../../SettingNumerical/Gauge';
import {
  enableLegacyJson,
  sendLegacyJson,
  restoreValues,
  getCurrentBrightness,
  setBluetoothPower,
  getBluetoothStatus,
  playSoundTest,
  getWiFiRadioStatus,
  getWiFiMode
} from './legacyApi';
import { TestOptionsOption, ProfileTestCommand } from './TestCommands/types';
import { handleBrightnessSafety } from './TestCommands/brightnessSafety';
import { BooleanTestScreen } from './BooleanTestScreen';
import { WiFiTestMenu } from './WiFiTestMenu';

interface LoadingState {
  isLoading: boolean;
  message: string;
}

interface StatusValues {
  wifi: {
    enabled: boolean;
    mode: 'AP' | 'CLIENT';
  };
  bluetooth: boolean;
  brightness: number;
}

const defaultTests: TestOptionsOption[] = [
  {
    key: 'set_motor_heater_pwm',
    label: 'Motor & Heater Control',
    opensControlPanel: true
  },
  {
    key: 'test_wifi',
    label: 'Test wifi',
    opensWiFiMenu: true
  },
  {
    key: 'test_bluetooth',
    label: 'Test bluetooth',
    isBoolean: true
  },
  {
    key: 'set_lcd_brightness',
    label: 'Set lcd brightness',
    maxValue: 100,
    interval: 5,
    unit: '%'
  },
  {
    key: 'test_speaker',
    label: 'Test speaker',
    isBoolean: true
  },
  {
    key: 'exit',
    label: 'Exit'
  }
];

const TextContainer = ({
  text,
  isActive,
  option,
  statusValues
}: {
  text: string;
  isActive: boolean;
  option: TestOptionsOption;
  statusValues: StatusValues;
}) => {
  const getStatusText = () => {
    switch (option.key) {
      case 'test_wifi':
        return statusValues.wifi.enabled
          ? `: ON ${statusValues.wifi.mode}`
          : ': OFF';
      case 'test_bluetooth':
        return `: ${statusValues.bluetooth ? 'ON' : 'OFF'}`;
      case 'set_lcd_brightness':
        return `: ${statusValues.brightness}%`;
      default:
        return '';
    }
  };

  const fullText = `${text}${getStatusText()}`;
  const shouldAnimate = fullText.length > 11 && isActive;

  return (
    <div className="text-container">
      <span>
        <span className={shouldAnimate ? 'animate-marquee' : ''}>
          <span
            className={
              isActive ? 'presset-option-label active' : 'presset-option-label'
            }
          >
            {fullText.toUpperCase()}
          </span>
        </span>
      </span>
    </div>
  );
};

const getUnitForGauge = (unit: '%' | 'PWM'): 'percent' | 'pwm' => {
  switch (unit) {
    case '%':
      return 'percent';
    case 'PWM':
      return 'pwm';
    default:
      return 'pwm';
  }
};

export function TestOptions(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animationStyle, setAnimationStyle] = useState('');
  const [currentValue, setCurrentValue] = useState<number | boolean>(0);
  const [isGaugeVisible, setIsGaugeVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBooleanScreen, setShowBooleanScreen] = useState(false);
  const [showWiFiMenu, setShowWiFiMenu] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: ''
  });
  const [statusValues, setStatusValues] = useState<StatusValues>({
    wifi: {
      enabled: false,
      mode: 'CLIENT'
    },
    bluetooth: false,
    brightness: 0
  });

  const [booleanScreenState, setBooleanScreenState] = useState({
    title: '',
    initialValue: false,
    onToggle: async (value: boolean) => {
      console.log('Default toggle handler called with value:', value);
    },
    key: ''
  });

  const currentTest = defaultTests[activeIndex];

  const loadInitialStatus = async () => {
    try {
      const [wifiRadio, wifiMode, bluetoothStatus, brightness] =
        await Promise.all([
          getWiFiRadioStatus(),
          getWiFiMode(),
          getBluetoothStatus(),
          getCurrentBrightness()
        ]);

      setStatusValues({
        wifi: {
          enabled: wifiRadio,
          mode: wifiMode
        },
        bluetooth: bluetoothStatus,
        brightness: brightness
      });
    } catch (error) {
      console.error('Error loading initial status:', error);
    }
  };

  useEffect(() => {
    loadInitialStatus();
  }, []);

  const initializeGauge = async (activeItem: TestOptionsOption) => {
    if (activeItem.key === 'test_speaker') {
      return;
    }

    setIsLoading(true);
    try {
      if (activeItem.key === 'set_lcd_brightness') {
        const currentBrightness = await getCurrentBrightness();
        setCurrentValue(currentBrightness);
        setStatusValues((prev) => ({
          ...prev,
          brightness: currentBrightness
        }));
        setIsGaugeVisible(true);
      } else if (activeItem.key === 'test_bluetooth') {
        const bluetoothEnabled = await getBluetoothStatus();
        setBooleanScreenState({
          title: 'Bluetooth',
          initialValue: bluetoothEnabled,
          onToggle: async (value) => {
            await setBluetoothPower(value);
            setStatusValues((prev) => ({
              ...prev,
              bluetooth: value
            }));
          },
          key: 'test_bluetooth'
        });
        setShowBooleanScreen(true);
      } else if (activeItem.isBoolean) {
        setCurrentValue(false);
        setIsGaugeVisible(true);
      } else {
        setCurrentValue(0);
        setIsGaugeVisible(true);
      }
    } catch (error) {
      console.error('Error initializing gauge:', error);
      if (activeItem.isBoolean) {
        setCurrentValue(false);
      } else {
        setCurrentValue(0);
      }
      setIsGaugeVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestCommand = async (
    activeItem: TestOptionsOption,
    value: number | boolean
  ) => {
    try {
      await enableLegacyJson();

      if (activeItem.key === 'set_lcd_brightness') {
        await handleBrightnessSafety(
          value as number,
          (restoredValue: number) => {
            setStatusValues((prev) => ({
              ...prev,
              brightness: restoredValue
            }));
            setCurrentValue(restoredValue);
          }
        );
        setStatusValues((prev) => ({
          ...prev,
          brightness: value as number
        }));
        return;
      }

      if (!activeItem.createCommand) {
        return;
      }

      const testCommand = activeItem.createCommand(value);

      if (testCommand.type === 'profile') {
        await sendLegacyJson((testCommand as ProfileTestCommand).profile);
        console.log(
          'Legacy profile command sent successfully:',
          testCommand.profile
        );
      } else {
        console.log('Simple test command:', testCommand);
      }
    } catch (error) {
      console.error('Error sending test command:', error);
    }
  };

  useHandleGestures(
    {
      left() {
        if (showWiFiMenu || showBooleanScreen) return;

        if (isGaugeVisible && !isLoading) {
          if (currentTest.isBoolean) {
            setCurrentValue(false);
          } else if (typeof currentValue === 'number') {
            const newValue = Math.max(currentValue - currentTest.interval, 0);
            setCurrentValue(newValue);
          }
        } else if (activeIndex > 0) {
          setActiveIndex((prev) => prev - 1);
        }
      },
      right() {
        if (showWiFiMenu || showBooleanScreen) return;

        if (isGaugeVisible && !isLoading) {
          if (currentTest.isBoolean) {
            setCurrentValue(true);
          } else if (typeof currentValue === 'number' && currentTest.maxValue) {
            const newValue = Math.min(
              currentValue + currentTest.interval,
              currentTest.maxValue
            );
            setCurrentValue(newValue);
          }
        } else if (activeIndex < defaultTests.length - 1) {
          setActiveIndex((prev) => prev + 1);
        }
      },
      pressDown: async () => {
        if (isLoading || loadingState.isLoading) return;

        const activeItem = defaultTests[activeIndex];

        if (activeItem.key === 'test_speaker') {
          try {
            await playSoundTest();
          } catch (error) {
            console.error('Error testing speaker:', error);
          }
          return;
        }

        if (isGaugeVisible) {
          await sendTestCommand(activeItem, currentValue);
          setIsGaugeVisible(false);
          return;
        }

        switch (activeItem.key) {
          case 'test_wifi':
            setShowWiFiMenu(true);
            break;
          case 'exit':
            try {
              setLoadingState({
                isLoading: true,
                message: 'Restoring values...'
              });

              await restoreValues((progress) => {
                setLoadingState({
                  isLoading: progress.isLoading,
                  message: progress.message
                });
              });

              dispatch(setScreen('pressets'));
              dispatch(setBubbleDisplay({ visible: false, component: null }));
            } catch (error) {
              console.error('Error during exit:', error);
              dispatch(setScreen('pressets'));
              dispatch(setBubbleDisplay({ visible: false, component: null }));
            } finally {
              setLoadingState({
                isLoading: false,
                message: ''
              });
            }
            break;
          case 'set_motor_heater_pwm':
            dispatch(setScreen('menu-motor-heater'));
            break;
          default:
            await initializeGauge(activeItem);
            break;
        }
      }
    },
    bubbleDisplay.visible ||
      isLoading ||
      showBooleanScreen ||
      showWiFiMenu ||
      loadingState.isLoading
  );

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  if (showWiFiMenu) {
    return (
      <WiFiTestMenu
        onBack={async () => {
          try {
            const [wifiRadio, wifiMode] = await Promise.all([
              getWiFiRadioStatus(),
              getWiFiMode()
            ]);

            setStatusValues((prev) => ({
              ...prev,
              wifi: {
                enabled: wifiRadio,
                mode: wifiMode as 'AP' | 'CLIENT'
              }
            }));
          } catch (error) {
            console.error('Error updating WiFi status:', error);
          } finally {
            setShowWiFiMenu(false);
            setIsGaugeVisible(false);
          }
        }}
      />
    );
  }

  if (showBooleanScreen) {
    return (
      <BooleanTestScreen
        title={booleanScreenState.title}
        initialValue={booleanScreenState.initialValue}
        onToggle={booleanScreenState.onToggle}
        onBack={() => {
          setShowBooleanScreen(false);
          setIsGaugeVisible(false);
        }}
      />
    );
  }

  return (
    <div className="presset-container">
      {(isGaugeVisible || loadingState.isLoading) && !showBooleanScreen && (
        <div className="gauge-overlay">
          {isLoading || loadingState.isLoading ? (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <div className="loading-message">
                {loadingState.message || 'Loading...'}
              </div>
            </div>
          ) : (
            <>
              {!currentTest.isBoolean && currentTest.unit && (
                <div className="gauge-container">
                  <Gauge
                    value={currentValue as number}
                    maxValue={currentTest.maxValue}
                    precision={0}
                    unit={getUnitForGauge(currentTest.unit)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="presset-options">
        <Swiper
          onSwiper={setSwiper}
          slidesPerView={9}
          allowTouchMove={false}
          direction="vertical"
          autoHeight={false}
          centeredSlides={true}
          initialSlide={activeIndex}
          onSlideNextTransitionStart={() => {
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          {defaultTests.map((item, index) => (
            <SwiperSlide
              className="presset-option-item"
              key={`option-${index}`}
            >
              <div className={animationStyle}>
                <TextContainer
                  text={item.label}
                  isActive={index === activeIndex}
                  option={item}
                  statusValues={statusValues}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <div className="fade fade-top"></div>
      <div className="fade fade-bottom"></div>
    </div>
  );
}

export default TestOptions;
