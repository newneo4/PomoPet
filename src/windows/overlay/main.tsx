import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OverlayApp } from "./OverlayApp";
import "./overlay.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element in overlay.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
);
