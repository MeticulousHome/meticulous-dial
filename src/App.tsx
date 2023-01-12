import * as ReactDOM from 'react-dom/client';
import { Barometer } from './components/Barometer/Barometer';

const App = (): JSX.Element => {
  const sensors = { p: '0', t: '0', w: '0', f: '0' };
  const time = '0';
  const name = 'IDLE';
  return <Barometer sensors={sensors} name={name} time={time} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
