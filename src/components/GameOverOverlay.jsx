/**
 * Full-screen overlay shown when the game ends (win or loss). Displays a
 * summary and a "Play Again" button.
 *
 * Only renders when `gameState` is not `"playing"`.
 *
 * @param {{
 *   gameState: "playing" | "gameover" | "won",
 *   gameOverReason: string|null,
 *   currentWave: number,
 *   turnCount: number,
 *   winWaves: number,
 *   onPlayAgain: () => void,
 * }} props
 */
export function GameOverOverlay({
  gameState,
  gameOverReason,
  currentWave,
  turnCount,
  winWaves,
  onPlayAgain,
}) {
  if (gameState === "playing") return null;

  const won = gameState === "won";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.82)",
        zIndex: 100,
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          background: "#111",
          border: `2px solid ${won ? "#5d5" : "#c44"}`,
          borderRadius: 8,
          padding: "40px 52px",
          textAlign: "center",
          maxWidth: 420,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: won ? "#5d5" : "#f44",
            marginBottom: 16,
          }}
        >
          {won ? "Victory!" : "Game Over"}
        </div>
        {won ? (
          <div style={{ color: "#aaa", marginBottom: 24, lineHeight: 1.6 }}>
            You survived {winWaves} waves of adventurers and kept the dungeon
            cozy.
            <br />
            The monsters are very grateful.
          </div>
        ) : (
          <div style={{ color: "#aaa", marginBottom: 24, lineHeight: 1.6 }}>
            {gameOverReason}
            <br />
            <span style={{ fontSize: 12, color: "#666" }}>
              Survived {currentWave} wave{currentWave !== 1 ? "s" : ""} ·{" "}
              {turnCount} turns
            </span>
          </div>
        )}
        <button
          onClick={onPlayAgain}
          style={{
            background: won ? "#2a5" : "#922",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "10px 28px",
            fontSize: 15,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
