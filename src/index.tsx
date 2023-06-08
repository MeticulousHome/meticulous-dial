import './globals.css';
import 'swiper/swiper-bundle.min.css';
import { Provider as ReduxProvider } from 'react-redux';
import ReactDOM from 'react-dom/client';
import { SocketManager } from './components/store/SocketManager';
import App from './App';
import { store } from './components/store/store';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <ReduxProvider store={store}>
    <SocketManager>
      <App />
    </SocketManager>
  </ReduxProvider>
);
