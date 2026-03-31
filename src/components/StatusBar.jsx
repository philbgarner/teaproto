import styles from "./styles/StatusBar.module.css";

/**
 * Bottom status bar showing position, facing direction, HP, XP, and
 * ingredient inventory.
 *
 * @param {{
 *   camera: { x: number, z: number, yaw: number },
 *   facing: string,
 *   playerHp: number,
 *   playerMaxHp: number,
 *   playerXp: number,
 *   ingredients: { rations: number, herbs: number, dust: number },
 * }} props
 */
function tempBand(temp) {
  if (temp < 52) return "Cold";
  if (temp < 103) return "Cool";
  if (temp < 154) return "Neutral";
  if (temp < 205) return "Cozy";
  return "Warm";
}

export function StatusBar({ camera, facing, playerXp, ingredients, currentRoomTemp }) {
  return (
    <div className={styles.bar}>
      <span className={styles.coords}>
        ({Math.floor(camera.x)}, {Math.floor(camera.z)})
      </span>
      <span className={styles.facing}>Facing: {facing}</span>
      <span className={styles.xp}>XP: {playerXp}</span>
      <span className={styles.ingredients}>
        Rations: {ingredients.rations} · Herbs: {ingredients.herbs} · Dust:{" "}
        {ingredients.dust}
      </span>
      <span className={styles.roomTemp}>
        Room Temp: {tempBand(currentRoomTemp)}
      </span>
    </div>
  );
}
