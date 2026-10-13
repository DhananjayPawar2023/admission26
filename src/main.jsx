import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (!window.__reactRoot) {
  window.__reactRoot = createRoot(container);
}
window.__reactRoot.render(<App />);
