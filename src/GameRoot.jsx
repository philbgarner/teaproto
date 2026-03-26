import { useState } from "react";
import { TitleScreen } from "./components/TitleScreen";
import App from "./App.jsx";

export function GameRoot() {
  // 'title' | 'transitioning' | 'game'
  const [phase, setPhase] = useState("title");
  const [titleOpacity, setTitleOpacity] = useState(1);
  const [gameOpacity, setGameOpacity] = useState(0);

  function handleNewGame() {
    // Called after menu items have already faded out inside TitleScreen
    setPhase("transitioning");
    setTitleOpacity(0); // fade out title canvas
    // Fade in game slightly offset
    setTimeout(() => setGameOpacity(1), 200);
    // Remove title from DOM after transition completes
    setTimeout(() => setPhase("game"), 800);
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#000",
      }}
    >
      {/* Game — rendered beneath, fades in */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: gameOpacity,
          transition: "opacity 0.55s ease-in",
        }}
      >
        <App />
      </div>

      {/* Title screen — rendered on top, fades out */}
      {phase !== "game" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            opacity: titleOpacity,
            transition: "opacity 0.55s ease-out",
            pointerEvents: phase === "title" ? "auto" : "none",
          }}
        >
          <TitleScreen onNewGame={handleNewGame} />
        </div>
      )}
    </div>
  );
}
