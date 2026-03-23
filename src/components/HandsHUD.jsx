/**
 * Displays a single held tea item, showing its name, current temperature,
 * whether it's in the ideal range, and whether it's been ruined.
 */
function HandDisplay({ label, tea }) {
  if (!tea) {
    return (
      <div style={{ color: "#555" }}>
        <span style={{ color: "#777" }}>{label}:</span> empty
      </div>
    );
  }
  const [lo, hi] = tea.recipe.idealTemperatureRange;
  const tempColor = tea.ruined
    ? "#f44"
    : tea.temperature > hi
      ? "#f80"
      : "#4f4";
  const tempLabel = tea.ruined
    ? "(RUINED)"
    : tea.temperature > hi
      ? "(too hot)"
      : "(ideal)";
  return (
    <div>
      <span style={{ color: "#777" }}>{label}:</span>{" "}
      <span style={{ color: tea.ruined ? "#f44" : "#fa0" }}>{tea.name}</span>{" "}
      <span style={{ color: tempColor }}>
        {tea.temperature}° {tempLabel}
      </span>
      <span style={{ color: "#555", fontSize: 11 }}>
        {" "}
        [{lo}–{hi}°]
      </span>
    </div>
  );
}

/**
 * Fixed bottom HUD overlay showing what the player is holding in each hand.
 * Positioned to the left of the minimap sidebar (right: 220px).
 *
 * @param {{ left: object|null, right: object|null }} hands - Left and right held tea items.
 */
export function HandsHUD({ hands }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "2.25rem",
        left: 80,
        right: 400,
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 20px",
        background: "rgba(0,0,0,0.88)",
        borderTop: "1px solid #333",
        fontFamily: "monospace",
        fontSize: 13,
        pointerEvents: "none",
      }}
    >
      <HandDisplay label="Left Hand" tea={hands.left} />
      <HandDisplay label="Right Hand" tea={hands.right} />
    </div>
  );
}
