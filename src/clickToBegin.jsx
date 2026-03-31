import { useState } from "react";
import { GameRoot } from "./GameRoot.jsx";

export function ClickToBegin({ onBegin }) {
  return (
    <div
      onClick={onBegin}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 9999,
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.7)",
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          animation: "ctb-pulse 2s ease-in-out infinite",
          margin: 0,
        }}
      >
        Click to Begin
      </p>
      <style>{`
        @keyframes ctb-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function Root() {
  const [begun, setBegun] = useState(false);
  if (!begun) return <ClickToBegin onBegin={() => setBegun(true)} />;
  return <GameRoot />;
}
