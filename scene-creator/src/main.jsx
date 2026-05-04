import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

document.documentElement.style.margin = "0";
document.documentElement.style.width = "100%";
document.documentElement.style.height = "100%";
document.documentElement.style.overflow = "hidden";
document.body.style.margin = "0";
document.body.style.width = "100%";
document.body.style.height = "100%";
document.body.style.overflow = "hidden";
document.body.style.background = "#10151d";
const rootElement = document.getElementById("root");
if (rootElement) {
  rootElement.style.width = "100%";
  rootElement.style.height = "100%";
  rootElement.style.overflow = "hidden";
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
