import { useRef } from 'react';
import * as ReactDOM from 'react-dom/client';

import { Barometer } from './components/Barometer/Barometer';
import { SockerManager } from './components/store/SockerManager';

const App = (): JSX.Element => {
  //@ts-ignore
  console.info(window.meticulous_envs.SERVER_URL());

  const sensors = { p: '4', t: '0', w: '0', f: '0' };
  const time = '0';
  const name = 'IDLE';

  return (
    <SockerManager>
      <Barometer stats={{ sensors, time, name }} />
    </SockerManager>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
