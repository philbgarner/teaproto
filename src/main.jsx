import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { GameRoot } from "./GameRoot.jsx";
import { ClickToBegin, Root } from "./clickToBegin.jsx";

console.log("[main] createRoot");
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
