/**
 * Overlay shown in the top-right of the 3D view when the next adventurer wave
 * is imminent and no adventurers are currently alive. Only renders when
 * `turnsLeft` is at or below `threshold` and the current wave is cleared.
 *
 * @param {{
 *   turnsLeft: number,
 *   visible: boolean,
 * }} props
 */
export function WaveCountdown({ turnsLeft, visible }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        background: "rgba(160,20,20,0.82)",
        border: "1px solid #f88",
        padding: "6px 14px",
        borderRadius: 4,
        fontSize: 13,
        color: "#fcc",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      ⚠ Next wave in {turnsLeft} turn{turnsLeft !== 1 ? "s" : ""}
    </div>
  );
}
