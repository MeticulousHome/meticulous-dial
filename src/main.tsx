import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// import { getCurrentWindow } from '@tauri-apps/api/window';
// await getCurrentWindow().setFullscreen(true);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
