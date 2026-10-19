import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cal-sans/400.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-mono/500.css";
import "./styles.css";
import "./soda/soda.css";
import { App } from "./ui/App";
document.body.classList.add("sd-canvas");
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
