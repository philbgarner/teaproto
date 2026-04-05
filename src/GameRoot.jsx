import { useState } from "react";
import { TitleScreen } from "./components/TitleScreen";
import App from "./App.jsx";
import Tutorial from "./Tutorial.jsx";
import { SettingsProvider } from "./SettingsContext";

export function GameRoot() {
  console.log("[GameRoot] render");
  // 'title' | 'transitioning' | 'tutorial' | 'game'
  const [phase, setPhase] = useState("title");
  const [titleOpacity, setTitleOpacity] = useState(1);
  const [gameOpacity, setGameOpacity] = useState(0);

  function handleNewGame() {
    // Called after menu items have already faded out inside TitleScreen
    setPhase("transitioning");
    setTitleOpacity(0);
    setTimeout(() => setGameOpacity(1), 200);
    setTimeout(() => setPhase("game"), 800);
  }

  function handleTutorial() {
    // Fade title out, show tutorial immediately (no game underneath yet)
    setPhase("transitioning");
    setTitleOpacity(0);
    setTimeout(() => setPhase("tutorial"), 800);
  }

  function handleTutorialComplete() {
    // Tutorial.tsx applies Easy settings before calling this.
    // Just transition to the game.
    setGameOpacity(0);
    setTimeout(() => setGameOpacity(1), 200);
    setPhase("game");
  }

  function handleReturnToTitle() {
    setGameOpacity(0);
    setTimeout(() => {
      setTitleOpacity(0);
      setPhase("title");
      setTimeout(() => setTitleOpacity(1), 50);
    }, 400);
  }

  return (
    <SettingsProvider>
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          background: "#000",
        }}
      >
        {/* Game - rendered beneath, fades in */}
        {(phase === "game" || phase === "transitioning") && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: gameOpacity,
              transition: "opacity 0.55s ease-in",
            }}
          >
            <App onReturnToTitle={handleReturnToTitle} />
          </div>
        )}

        {/* Tutorial */}
        {phase === "tutorial" && (
          <Tutorial onComplete={handleTutorialComplete} />
        )}

        {/* Title screen - rendered on top, fades out */}
        {phase !== "game" && phase !== "tutorial" && (
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
            <TitleScreen onNewGame={handleNewGame} onTutorial={handleTutorial} />
          </div>
        )}
      </div>
    </SettingsProvider>
  );
}
