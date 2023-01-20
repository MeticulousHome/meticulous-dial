import { useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import { store } from './components/store/store';
import { Barometer } from './components/Barometer/Barometer';
import { SockerManager } from './components/store/SockerManager';
/* import { useAppSelector } from './components/store/hooks'; */
/* import { Scale } from './components/Scale/Scale'; */
/* import { Pressets } from './components/Pressets/Pressets'; */
/* import { PressetSettings } from './components/PressetSettings/PressetSettings'; */
/* import { TemperatureScale } from './components/TemperatureScale/TemperatureScale'; */

const App = (): JSX.Element => {
  //console.info(window.meticulous_envs.SERVER_URL());

  const sensors = { p: '4', t: '0', w: '0', f: '0' };
  const time = '0';
  const name = 'IDLE';

  return (
    <SockerManager>
      <Barometer stats={{ sensors, name, time }} />
      {/* <Pressets /> */}
      {/* <PressetSettings /> */}
      {/* <Scale /> */}
      {/* <TemperatureScale /> */}
    </SockerManager>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
