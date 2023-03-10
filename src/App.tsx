import { useCallback, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import 'swiper/swiper-bundle.min.css';

import { Barometer } from './components/Barometer/Barometer';
import MainTitle from './components/MainTitle';
import { Pressets } from './components/Pressets/Pressets';
import { Scale } from './components/Scale/Scale';
import { useAppSelector } from './components/store/hooks';
import { SockerManager } from './components/store/SockerManager';
import { store } from './components/store/store';
/* import { PressetSettings } from './components/PressetSettings/PressetSettings'; */
// import { TemperatureScale } from './components/TemperatureScale/TemperatureScale';
import { CircleKeyboard } from './components/CircleKeyboard/CircleKeyboard';

import BottomStatus from './components/BottomStatus';
import { PressetTitle } from './components/Pressets/PressetsTitle';
import { PressetSettings } from './components/PressetSettings/PressetSettings';
import { SettingNumerical } from './components/SettingNumerical/SettingNumerical';
import { useFetchData } from './hooks/useFetchData';
import { useHandleGesture } from './hooks/useHandleGestures';
import { IPresetType } from './types';
import { OnOff } from './components/OnOff/OnOff';
import { Purge } from './components/Purge/Purge';

const App = (): JSX.Element => {
  //console.info(window.meticulous_envs.SERVER_URL());
  const { stats, presets } = useAppSelector((state) => state);
  const [presetSettingIndex, setPresetSettingIndex] = useState<IPresetType>('');
  const keyboardReady = useRef(false);
  const { screen } = useAppSelector((state) => state);
  //const [option, setOption] = useState(false); // Emulate Save or Cancel option
  useFetchData();
  useHandleGesture({ presetSettingIndex, keyboardReady });

  // if (error) {
  //   return <div className="main-layout">Error</div>;
  // }
  // if (pending) {
  //   return <div className="main-layout">Loading</div>;
  // }

  const getAnimation = useCallback(() => {
    let animation = 'barometer__fadeIn';

    if (screen.value === 'scale') {
      animation = 'barometerToScale__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className="main-layout">
      <Scale />
      <div className={`main-layout ${getAnimation()}`}>
        <PressetTitle />
        <MainTitle />
        <Barometer
          stats={{
            sensors: stats.sensors,
            name: stats.name,
            time: stats.time,
            profile:
              stats.name === 'idle'
                ? presets?.activePreset?.name
                : stats?.profile
          }}
        />
        <SettingNumerical type="temperature" />
        <Pressets />
        <CircleKeyboard
          callback={() => {
            keyboardReady.current = true;
          }}
        />
        <PressetSettings
          optionSelected={(option: string) =>
            setPresetSettingIndex(option as IPresetType)
          }
        />
        {/* </div> */}
        <OnOff />
        <Purge />

        <BottomStatus />
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <SockerManager>
      <App />
    </SockerManager>
  </Provider>
);
