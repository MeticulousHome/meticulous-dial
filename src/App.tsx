import { useCallback, useContext, useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import 'swiper/swiper-bundle.min.css';

import { store } from './components/store/store';
import { Barometer } from './components/Barometer/Barometer';
import { SockerManager, SockerContext } from './components/store/SockerManager';
/* import { useAppSelector } from './components/store/hooks'; */
import { Scale } from './components/Scale/Scale';
import { Pressets } from './components/Pressets/Pressets';
import MainTitle from './components/MainTitle';
import { useAppSelector } from './components/store/hooks';
/* import { PressetSettings } from './components/PressetSettings/PressetSettings'; */
import { TemperatureScale } from './components/TemperatureScale/TemperatureScale';
import { setScreen } from './components/store/features/screens/screens-slice';
import { setGesture } from './components/store/features/gestures/gestures-slice';
import { CircleKeyboard } from './components/CircleKeyboard/CircleKeyboard';
import {
  nextPreset,
  prevPreset
} from './components/store/features/preset/preset-slice';
import {
  resetActiveSetting,
  setActiveSetting,
  setNextSettingOption,
  setPrevSettingOption
} from './components/store/features/presetSetting/presetSetting-slice';
import { PressetSettings } from './components/PressetSettings/PressetSettings';
import BottomStatus from './components/BottomStatus';
import { SettingNumerical } from './components/SettingNumerical/SettingNumerical';

const App = (): JSX.Element => {
  //console.info(window.meticulous_envs.SERVER_URL());

  const dispatch = useContext(SockerContext);

  const { gesture, screen, stats } = useAppSelector((state) => state);
  //const [option, setOption] = useState(false); // Emulate Save or Cancel option
  let option = true;

  useEffect(() => {
    console.log('Prev Gesture >> ', gesture.prev);
    console.log('Current Gesture >> ', gesture.value);
    console.log('Prev Screen >> ', screen.prev);
    console.log('Current Screen >> ', screen.value);

    switch (screen.value) {
      case 'barometer':
        if (gesture.value === 'right' || gesture.value === 'left') {
          dispatch(setScreen('pressets'));
        } else if (gesture.value === 'click') {
          dispatch(setScreen('pressetSettings'));
        } else if (gesture.value === 'doubleClick') {
          dispatch(setScreen('scale'));
        }
        break;
      case 'pressets':
        if (gesture.value === 'click') {
          dispatch(setScreen('barometer'));
        } else if (gesture.value === 'left') {
          dispatch(prevPreset());
        } else if (gesture.value === 'right') {
          dispatch(nextPreset());
        }
        break;
      case 'pressetSettings':
        if (gesture.value === 'click' && option) {
          option = false;
          dispatch(setScreen('settingNumerical'));
          //dispatch(resetActiveSetting());
        } else if (gesture.value === 'right') {
          dispatch(setNextSettingOption());
        } else if (gesture.value === 'left') {
          dispatch(setPrevSettingOption());
        } else if (gesture.value === 'doubleClick') {
          dispatch(setScreen('barometer'));
        }
        break;
      case 'scale':
        if (gesture.value === 'doubleClick') {
          dispatch(setScreen('barometer'));
        }
        break;
      case 'settingNumerical':
        if (gesture.value === 'click') {
          dispatch(setScreen('pressetSettings'));
        }
        break;
      default:
        break;
    }

    dispatch(setGesture('')); // we need to clean the state up to receive event notification
  }, [gesture, screen]);

  const getAnimation = useCallback(() => {
    let animation = '';
    if (screen.value === 'pressets') {
      animation = 'title__Big';
    } else if (screen.value === 'pressetSettings') {
      if (screen.prev === 'settingNumerical') {
        animation = 'titleBigSettingNumerical';
      } else {
        animation = 'title__BigTwo';
      }
    } else if (screen.value === 'settingNumerical') {
      animation = 'titleSmallSettingNumerical';
    } else if (
      screen.value === 'barometer' &&
      screen.prev === 'pressetSettings'
    ) {
      animation = 'title__smallTwo';
    } else {
      animation = 'title__small';
    }

    return animation;
  }, [screen]);

  return (
    <div className="main-layout">
      <div
        className="title-main-1"
        style={{ display: `${screen.value === 'pressets' ? 'block' : 'none'}` }}
      >
        pressets
      </div>
      {/* <div className="test-mid-screen"></div> */}
      {/* <TemperatureScale /> */}
      <div
        className={`main-title-selected ${getAnimation()}`}
        style={{
          display: `${
            (screen.value !== 'barometer' &&
              screen.value !== 'pressets' &&
              screen.value !== 'settingNumerical' &&
              screen.value !== 'pressetSettings') ||
            screen.prev === 'scale'
              ? 'none'
              : ''
          }`,
          width: '100%'
        }}
      >
        <MainTitle />
      </div>
      <Barometer
        stats={{ sensors: stats.sensors, name: stats.name, time: stats.time }}
      />

      <Scale />

      <SettingNumerical type="temperature" />

      {/* <div
        style={{
          display: `${screen.value === 'pressets' ? 'block' : 'none'}`,
          width: '100%',
          height: '100%'
        }}
      > */}
      <Pressets />
      {/* </div> */}
      {/* <div
        style={{
          display: `${screen.value === 'pressetSettings' ? 'block' : 'none'}`,
          width: '100%',
          height: '100%'
        }}
      > */}
      {/* <CircleKeyboard callback={() => (option = true)} /> */}
      <PressetSettings />
      {/* </div> */}

      <BottomStatus />
    </div>
  );
  {
    /* <Barometer stats={{ sensors, name, time }} /> */
  }
  {
    /* <Pressets /> */
  }
  {
    /* <PressetSettings /> */
  }
  {
    /* <Scale /> */
  }
  {
    /* <TemperatureScale /> */
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <SockerManager>
      <App />
    </SockerManager>
  </Provider>
);
