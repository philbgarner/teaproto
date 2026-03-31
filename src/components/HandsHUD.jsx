import styles from "./styles/HandsHUD.module.css";

/**
 * Displays a single held tea item, showing its name, current temperature,
 * whether it's in the ideal range, and whether it's been ruined.
 */
function HandDisplay({ label, tea }) {
  if (!tea) {
    return (
      <div className={styles.handEmpty}>
        <span className={styles.handLabel}>{label}:</span> empty
      </div>
    );
  }
  const [lo, hi] = tea.recipe.idealTemperatureRange;
  const tempClass = tea.ruined
    ? styles.tempRuined
    : tea.temperature > hi
      ? styles.tempHot
      : styles.tempNormal;
  const tempLabel = tea.ruined
    ? "(RUINED)"
    : tea.temperature > hi
      ? "(too hot)"
      : "(ideal)";
  return (
    <div>
      <span className={styles.handLabel}>{label}:</span>{" "}
      <span className={`${styles.teaName} ${tea.ruined ? styles.teaNameRuined : styles.teaNameNormal}`}>
        {tea.name}
      </span>{" "}
      <span className={tempClass}>
        {tea.temperature}° {tempLabel}
      </span>
      <span className={styles.tempRange}>
        {" "}[{lo}–{hi}°]
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
    <div className={styles.hud}>
      <HandDisplay label="Left Hand" tea={hands.left} />
      <HandDisplay label="Right Hand" tea={hands.right} />
    </div>
  );
}
