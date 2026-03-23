/**
 * Top header bar showing the game title, dungeon seed, and current wave number.
 *
 * @param {{ dungeonSeed: number, currentWave: number }} props
 */
export function GameHeader({ dungeonSeed, currentWave }) {
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
      <span
        style={{ color: currentWave > 0 ? "#f88" : "#555", fontSize: 12 }}
      >
        Wave {currentWave}
      </span>
    </div>
  );
}
