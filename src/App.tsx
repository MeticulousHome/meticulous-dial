import { useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider, useDispatch } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import Barometer from './components/Barometer/Barometer';
import { store } from './components/store/store';
import { SockerManager } from './components/store/SockerManager';
/* import { useAppSelector } from './components/store/hooks'; */
/* import { Scale } from './components/Scale/Scale'; */
/* import { Pressets } from './components/Pressets/Pressets'; */
/* import { PressetSettings } from './components/PressetSettings/PressetSettings'; */
/* import { TemperatureScale } from './components/TemperatureScale/TemperatureScale'; */
import { useAppSelector } from './components/store/hooks';
import ProfileName from './components/ProfileName';
import { AppContainer } from './app.style';
import { ScreenName } from './types';
import { setScreen } from './components/store/features/screens/screenSlice';
import { PressetSettings } from './components/PressetSettings/PressetSettings';
import { setGesture } from './components/store/features/gestures/gestures-slice';
import Pressets from './components/Pressets/Pressets';
import PresetIcon from './components/Pressets/PresetIcon';

const App = (): JSX.Element => {
  //console.info(window.meticulous_envs.SERVER_URL());

  const { gesture, screen } = useAppSelector((state) => state);
  const { screenName } = screen;
  const { value: gestureValue } = gesture;
  const dispatch = useDispatch();

  const [key, setKey] = useState('right');

  const sensors = { p: '4', t: '0', w: '0', f: '0' };
  const time = '0';
  const name = 'IDLE';

  useEffect(() => {
    if (gestureValue === 'right') {
      dispatch(setScreen(ScreenName.PROFILE_SETTING));
      setKey('right');
    }
    if (gestureValue === 'click') {
      dispatch(setScreen(ScreenName.INFO));
      setKey('space');
    }
    dispatch(setGesture(''));
  }, [gestureValue]);

  return (
    <SockerManager>
      {/* <Pressets /> */}
      {/* <PressetSettings /> */}
      {/* <Scale /> */}
      {/* <TemperatureScale /> */}
      <AppContainer>
        {/* <ProfileName name="Filter 2.1" />
        {screenName === ScreenName.INFO && (
          <Barometer stats={{ sensors, time, name }} />
        )}
      {screenName === ScreenName.PROFILE_SETTING && <Pressets />} */}
        <AnimatePresence>
          {
            <motion.div
              key={1}
              initial={false}
              animate={{
                opacity: key === 'right' ? 0 : 1 /* opacityInfo */,
                scale: key === 'right' ? 0 : 1 /* opacityInfo */
              }}
              //exit={{ opacity: 0, scale: 0 }}
            >
              <Barometer stats={{ sensors, time, name }} />
            </motion.div>
          }
          {
            //screenName === ScreenName.PROFILE_SETTING &&
            <Pressets>
              <div className="main-layout-content">
                <div className="pressets-conainer">
                  <motion.div
                    key={2}
                    initial={false}
                    animate={{
                      opacity: key === 'space' ? 0 : 1 /* opacityPresset */,
                      scale: key === 'space' ? 1.5 : 1 /* scalePresset */
                    }}
                    //exit={{ opacity: 0, scale:1.5 }}
                  >
                    <PresetIcon />
                  </motion.div>
                </div>
              </div>
            </Pressets>
          }
        </AnimatePresence>
      </AppContainer>
    </SockerManager>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
