/**
 * Full-screen overlay shown when the game ends (win or loss). Displays a
 * summary, the dungeon seed, and options to replay or return to the title.
 *
 * Only renders when `gameState` is not `"playing"`.
 *
 * @param {{
 *   gameState: "playing" | "gameover" | "won",
 *   gameOverReason: string|null,
 *   currentRound: number,
 *   turnCount: number,
 *   winRounds: number,
 *   seed: number,
 *   onPlaySameSeed: () => void,
 *   onPlayNewSeed: () => void,
 *   onReturnToTitle: () => void,
 * }} props
 */
export function GameOverOverlay({
  gameState,
  gameOverReason,
  currentRound,
  turnCount,
  winRounds,
  seed,
  onPlaySameSeed,
  onPlayNewSeed,
  onReturnToTitle,
}) {
  if (gameState === "playing") return null;

  const won = gameState === "won";
  const accent = won ? "#5d5" : "#c44";

  const btnBase = {
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "10px 20px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "'Metamorphous', serif",
    flex: 1,
  };

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
        fontFamily: "'Metamorphous', serif",
      }}
    >
      <div
        style={{
          background: "#111",
          border: `2px solid ${accent}`,
          borderRadius: 8,
          padding: "40px 52px",
          textAlign: "center",
          maxWidth: 440,
          width: "90vw",
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
          <div style={{ color: "#aaa", marginBottom: 16, lineHeight: 1.6 }}>
            You survived {winRounds} rounds of adventurers and kept the dungeon
            cozy.
            <br />
            The monsters are very grateful.
          </div>
        ) : (
          <div style={{ color: "#aaa", marginBottom: 16, lineHeight: 1.6 }}>
            {gameOverReason}
            <br />
            <span style={{ fontSize: 12, color: "#666" }}>
              Survived {currentRound} round{currentRound !== 1 ? "s" : ""} ·{" "}
              {turnCount} turns
            </span>
          </div>
        )}

        <div
          style={{
            marginBottom: 28,
            padding: "8px 16px",
            background: "#1a1a1a",
            borderRadius: 4,
            border: "1px solid #333",
            fontSize: 13,
            color: "#888",
            letterSpacing: 1,
          }}
        >
          Seed:{" "}
          <span style={{ color: "#bbb", fontFamily: "monospace", fontSize: 15 }}>
            {seed}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onPlaySameSeed}
            style={{ ...btnBase, background: won ? "#2a5" : "#922" }}
          >
            Same Seed
          </button>
          <button
            onClick={onPlayNewSeed}
            style={{ ...btnBase, background: "#446" }}
          >
            New Seed
          </button>
          <button
            onClick={onReturnToTitle}
            style={{ ...btnBase, background: "#333" }}
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
