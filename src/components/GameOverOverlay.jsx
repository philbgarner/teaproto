import styles from "./styles/SettingsTabs.module.css";
import panelStyles from "./styles/ModalPanelBackdrop.module.css";

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
    <div className={panelStyles.backdrop} style={{ position: "fixed", zIndex: 100 }}>
      <div
        className={panelStyles.panel}
        style={{ maxWidth: 460, width: "90vw", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className={panelStyles.header}>
          <span
            className={panelStyles.title}
            style={{ color: won ? "#5d5" : "#f44", textShadow: won ? "0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(85,221,85,0.3)" : "0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(255,68,68,0.3)" }}
          >
            {won ? "Victory!" : "Game Over"}
          </span>
        </div>

        {/* Body */}
        <div className={`${panelStyles.body} ${panelStyles.bodyScroll}`} style={{ gap: 16, display: "flex", flexDirection: "column" }}>
          {/* Description */}
          {won ? (
            <div style={{ color: "#9a8060", lineHeight: 1.6, textAlign: "center", fontSize: "0.82rem" }}>
              You survived {winRounds} rounds of adventurers and kept the dungeon cozy.
              <br />
              The monsters are very grateful.
            </div>
          ) : (
            <div style={{ color: "#9a8060", lineHeight: 1.6, textAlign: "center", fontSize: "0.82rem" }}>
              {gameOverReason}
              <br />
              <span style={{ fontSize: "0.75rem", color: "#7a6848" }}>
                Survived {currentRound} round{currentRound !== 1 ? "s" : ""} · {turnCount} turns
              </span>
              {dungeonStats?.teaomaticDestroyedBy && (
                <>
                  <br />
                  <span style={{ fontSize: "0.75rem", color: "#7a6848" }}>
                    Destroyed by: {dungeonStats.teaomaticDestroyedBy}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Seed */}
          <div className={styles.seedRow} style={{ justifyContent: "center" }}>
            <div className={styles.seedInput} style={{ flex: "unset", textAlign: "center", letterSpacing: 1 }}>
              <span className={styles.seedHeader} style={{ marginBottom: 0, display: "inline" }}>Seed: </span>
              <span style={{ color: "#c8a060", fontFamily: "monospace", fontSize: "0.88rem" }}>{seed}</span>
            </div>
          </div>

          {/* Stats */}
          {statRows.length > 0 && (
            <div className={styles.root} style={{ gap: 0 }}>
              <div className={styles.seedHeader} style={{ marginBottom: 8, letterSpacing: "0.1em" }}>
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
              style={{ flex: 1, padding: "10px 12px", color: won ? "#7fc87f" : "#c87878" }}
            >
              Same Seed
            </button>
            <button
              onClick={onPlayNewSeed}
              className={styles.seedBtn}
              style={{ flex: 1, padding: "10px 12px" }}
            >
              New Seed
            </button>
            <button
              onClick={onReturnToTitle}
              className={styles.seedBtn}
              style={{ flex: 1, padding: "10px 12px" }}
            >
              Title Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
