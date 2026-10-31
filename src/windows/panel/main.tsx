import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PanelApp } from "./PanelApp";
import "./panel.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element in panel.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <PanelApp />
  </StrictMode>,
);
