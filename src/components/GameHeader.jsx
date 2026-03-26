/**
 * Top header bar showing the game title, dungeon seed, and current wave number.
 *
 * @param {{ dungeonSeed: number, currentWave: number, onSettingsClick: () => void }} props
 */
export function GameHeader({ dungeonSeed, currentWave, onSettingsClick, onRandomizeSeed }) {
  return (
    <div
      style={{
        height: 40,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        borderBottom: "1px solid #333",
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: "bold", color: "#eee" }}>Tea Dungeon</span>
      <span style={{ color: "#666", fontSize: 12 }}>seed: {dungeonSeed}</span>
      <button
        onClick={onRandomizeSeed}
        style={{
          background: "transparent",
          border: "1px solid #444",
          color: "#888",
          fontSize: 12,
          padding: "2px 6px",
          cursor: "pointer",
          fontFamily: "'Metamorphous', serif",
        }}
      >
        rng
      </button>
      <span
        style={{ color: currentWave > 0 ? "#f88" : "#555", fontSize: 12 }}
      >
        Wave {currentWave}
      </span>
      <button
        onClick={onSettingsClick}
        style={{
          background: "transparent",
          border: "1px solid #444",
          color: "#888",
          fontSize: 12,
          padding: "2px 8px",
          cursor: "pointer",
          fontFamily: "'Metamorphous', serif",
        }}
      >
        settings
      </button>
    </div>
  );
}
