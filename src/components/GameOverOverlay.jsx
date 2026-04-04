import styles from "./styles/SettingsTabs.module.css";

/**
 * Full-screen overlay shown when the game ends (win or loss). Displays a
 * summary, dungeon stats, the dungeon seed, and options to replay or return
 * to the title.
 *
 * Only renders when `gameState` is not `"playing"`.
 */
export function GameOverOverlay({
  gameState,
  gameOverReason,
  currentRound,
  turnCount,
  winRounds,
  seed,
  dungeonStats,
  onPlaySameSeed,
  onPlayNewSeed,
  onReturnToTitle,
}) {
  if (gameState === "playing") return null;

  const won = gameState === "won";
  const accent = won ? "#5d5" : "#c44";

  const statRows = dungeonStats
    ? [
        { label: "Adventurers defeated", value: dungeonStats.adventurersDefeated },
        { label: "Monsters fell unconscious", value: dungeonStats.monstersFellUnconscious },
        { label: "Monsters resuscitated", value: dungeonStats.monstersResuscitated },
        { label: "Damage dealt to adventurers", value: dungeonStats.damageToAdventurers },
        { label: "Damage taken by monsters", value: dungeonStats.damageToMonsters },
        { label: "Dances with monsters", value: dungeonStats.danceWithMonsters },
        { label: "Dances with adventurers", value: dungeonStats.danceWithAdventurers },
        { label: "Ingredients collected", value: dungeonStats.ingredientsPickedUp },
      ]
    : [];

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
          padding: "32px 40px",
          maxWidth: 460,
          width: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: won ? "#5d5" : "#f44",
            textAlign: "center",
          }}
        >
          {won ? "Victory!" : "Game Over"}
        </div>

        {/* Description */}
        {won ? (
          <div style={{ color: "#aaa", lineHeight: 1.6, textAlign: "center", fontSize: 14 }}>
            You survived {winRounds} rounds of adventurers and kept the dungeon cozy.
            <br />
            The monsters are very grateful.
          </div>
        ) : (
          <div style={{ color: "#aaa", lineHeight: 1.6, textAlign: "center", fontSize: 14 }}>
            {gameOverReason}
            <br />
            <span style={{ fontSize: 12, color: "#666" }}>
              Survived {currentRound} round{currentRound !== 1 ? "s" : ""} · {turnCount} turns
            </span>
            {dungeonStats?.teaomaticDestroyedBy && (
              <>
                <br />
                <span style={{ fontSize: 12, color: "#888" }}>
                  Destroyed by: {dungeonStats.teaomaticDestroyedBy}
                </span>
              </>
            )}
          </div>
        )}

        {/* Seed */}
        <div
          style={{
            padding: "6px 14px",
            background: "#1a1a1a",
            borderRadius: 4,
            border: "1px solid #333",
            fontSize: 13,
            color: "#888",
            letterSpacing: 1,
            textAlign: "center",
          }}
        >
          Seed:{" "}
          <span style={{ color: "#bbb", fontFamily: "monospace", fontSize: 15 }}>
            {seed}
          </span>
        </div>

        {/* Stats */}
        {statRows.length > 0 && (
          <div className={styles.root} style={{ gap: 0 }}>
            <div
              className={styles.seedHeader}
              style={{ marginBottom: 8, letterSpacing: "0.1em", color: "#7a6848" }}
            >
              run stats
            </div>
            <div className={styles.content} style={{ gap: 4, padding: 0, maxHeight: 220 }}>
              {statRows.map(({ label, value }) => (
                <div
                  key={label}
                  className={styles.sliderRow}
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}
                >
                  <span className={styles.sliderLabel} style={{ marginBottom: 0 }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      color: "#c8a060",
                      marginLeft: 12,
                      flexShrink: 0,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={onPlaySameSeed}
            className={styles.seedBtn}
            style={{ flex: 1, padding: "10px 12px", fontSize: 13, color: won ? "#7fc87f" : "#c87878" }}
          >
            Same Seed
          </button>
          <button
            onClick={onPlayNewSeed}
            className={styles.seedBtn}
            style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
          >
            New Seed
          </button>
          <button
            onClick={onReturnToTitle}
            className={styles.seedBtn}
            style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
