import { useEffect, useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider, useDispatch } from 'react-redux';

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
import { Pressets } from './components/Pressets/Pressets';

const App = (): JSX.Element => {
  //console.info(window.meticulous_envs.SERVER_URL());

  const { gesture, screen } = useAppSelector((state) => state);
  const { screenName } = screen;
  const { value: gestureValue } = gesture;
  const dispatch = useDispatch();

  const sensors = { p: '4', t: '0', w: '0', f: '0' };
  const time = '0';
  const name = 'IDLE';

  useEffect(() => {
    if (gestureValue === 'right') {
      dispatch(setScreen(ScreenName.PROFILE_SETTING));
    }
    if (gestureValue === 'click') {
      dispatch(setScreen(ScreenName.INFO));
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
        <ProfileName name="Filter 2.1" />
        {screenName === ScreenName.INFO && (
          <Barometer stats={{ sensors, time, name }} />
        )}
        {screenName === ScreenName.PROFILE_SETTING && <Pressets />}
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
