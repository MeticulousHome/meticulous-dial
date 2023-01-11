import * as ReactDOM from 'react-dom/client';

const App = (): JSX.Element => {
  return <h1>Hello, Electron!</h1>;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
