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
export function StatusBar({ camera, facing, playerHp, playerMaxHp, playerXp, ingredients }) {
  return (
    <div
      style={{
        height: 36,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 24,
        borderTop: "1px solid #333",
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      <span>
        ({Math.floor(camera.x)}, {Math.floor(camera.z)})
      </span>
      <span>Facing: {facing}</span>
      <span
        style={{
          color: playerHp <= 5 ? "#f44" : playerHp <= 15 ? "#fa0" : "#4f4",
        }}
      >
        HP: {playerHp}/{playerMaxHp}
      </span>
      <span style={{ color: "#fa0" }}>XP: {playerXp}</span>
      <span style={{ color: "#0df", fontSize: 11 }}>
        Rations: {ingredients.rations} · Herbs: {ingredients.herbs} · Dust:{" "}
        {ingredients.dust}
      </span>
    </div>
  );
}
