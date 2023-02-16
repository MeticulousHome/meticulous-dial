import { useCallback, useContext, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import 'swiper/swiper-bundle.min.css';

import { store } from './components/store/store';
import { Barometer } from './components/Barometer/Barometer';
import { SockerManager, SockerContext } from './components/store/SockerManager';
import { Scale } from './components/Scale/Scale';
import { Pressets } from './components/Pressets/Pressets';
import MainTitle from './components/MainTitle';
import { useAppSelector } from './components/store/hooks';
/* import { PressetSettings } from './components/PressetSettings/PressetSettings'; */
// import { TemperatureScale } from './components/TemperatureScale/TemperatureScale';
// import { CircleKeyboard } from './components/CircleKeyboard/CircleKeyboard';

import { PressetSettings } from './components/PressetSettings/PressetSettings';
import BottomStatus from './components/BottomStatus';
import { useFetchData } from './hooks/useFetchData';
import { useHandleGesture } from './hooks/useHandleGestures';
import { SettingNumerical } from './components/SettingNumerical/SettingNumerical';

const App = (): JSX.Element => {
  //console.info(window.meticulous_envs.SERVER_URL());
  const { screen, stats } = useAppSelector((state) => state);
  const [presetSettingIndex, setPresetSettingIndex] = useState<number>(-1);
  //const [option, setOption] = useState(false); // Emulate Save or Cancel option

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
  useFetchData();
  useHandleGesture({ presetSettingIndex });

  // if (error) {
  //   return <div className="main-layout">Error</div>;
  // }
  // if (pending) {
  //   return <div className="main-layout">Loading</div>;
  // }

  return (
    <div className="main-layout">
      <MainTitle />
      <Barometer
        stats={{
          sensors: stats.sensors,
          name: stats.name,
          time: stats.time
        }}
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
      <PressetSettings
        optionSelected={(option: number) => setPresetSettingIndex(option)}
      />
      {/* </div> */}

      <BottomStatus />
    </div>
  );
};
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
// };

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <SockerManager>
      <App />
    </SockerManager>
  </Provider>
);
