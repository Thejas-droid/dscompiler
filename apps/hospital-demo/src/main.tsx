import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../.design-system/generated/tokens.css";
import "./design-system/button.css";
import "./styles.css";
import "./demo-violation.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
