import { useEffect } from "react";
import { drawMinimap } from "../utils/minimap";
import GhostInventory from "./GhostInventory";
import styles from "./styles/MinimapSidebar.module.css";

/**
 * Right sidebar containing the minimap canvas with hover tooltips, the
 * settings tabs, and a keyboard controls reference.
 *
 * The `minimapRef` and tooltip state/handlers come from `useMinimapData`.
 * The `drawMinimap` effect runs here so all minimap concerns are co-located.
 *
 * @param {{
 *   minimapRef: React.RefObject<HTMLCanvasElement>,
 *   minimapMobs: object[],
 *   minimapTooltip: object|null,
 *   setMinimapTooltip: (t: object|null) => void,
 *   onMinimapMouseMove: (e: MouseEvent) => void,
 *   solidData: Uint8Array,
 *   dungeonWidth: number,
 *   dungeonHeight: number,
 *   camera: { x: number, z: number, yaw: number },
 *   passagesRef: React.RefObject<object[]>,
 * }} props
 */
export function MinimapSidebar({
  minimapRef,
  minimapMobs,
  minimapTooltip,
  setMinimapTooltip,
  onMinimapMouseMove,
  solidData,
  temperatureData,
  showTempTint,
  dungeonWidth,
  dungeonHeight,
  camera,
  passagesRef,
  exploredMaskRef,
}) {
  useEffect(() => {
    if (!minimapRef.current) return;
    drawMinimap(
      minimapRef.current,
      solidData,
      dungeonWidth,
      dungeonHeight,
      camera.x,
      camera.z,
      camera.yaw,
      minimapMobs,
      passagesRef.current,
      showTempTint ? temperatureData : null,
      exploredMaskRef?.current ?? null,
    );
  }, [solidData, camera, minimapMobs, showTempTint, temperatureData]);

  return (
    <div className={styles.sidebar}>
      <span className={styles.label}>Minimap</span>
      <div className={styles.canvasWrap}>
        <canvas
          ref={minimapRef}
          width={196}
          height={196}
          className={styles.canvas}
          onMouseMove={onMinimapMouseMove}
          onMouseLeave={() => setMinimapTooltip(null)}
        />
        {minimapTooltip && (
          <div
            className={styles.tooltip}
            style={{
              ...(minimapTooltip.canvasX > 98
                ? { right: 196 - minimapTooltip.canvasX + 8, left: "auto" }
                : { left: minimapTooltip.canvasX + 8 }),
              top: minimapTooltip.canvasY - 8,
            }}
          >
            <div
              className={styles.tooltipName}
              style={{ color: minimapTooltip.mob.cssColor }}
            >
              {minimapTooltip.mob.name}
            </div>
            {minimapTooltip.mob.isXp || minimapTooltip.mob.isIngredient ? (
              <div
                className={styles.tooltipRow}
                style={{ color: minimapTooltip.mob.cssColor }}
              >
                Walk here to collect
              </div>
            ) : minimapTooltip.mob.isAdventurer ? (
              <div className={styles.tooltipRow}>
                HP:{" "}
                <span style={{ color: minimapTooltip.mob.cssColor }}>
                  {minimapTooltip.mob.hp}/{minimapTooltip.mob.maxHp}
                </span>
              </div>
            ) : (
              <>
                <div className={styles.tooltipRow}>
                  Status:{" "}
                  <span style={{ color: minimapTooltip.mob.cssColor }}>
                    {minimapTooltip.mob.status}
                  </span>
                </div>
                <div className={styles.tooltipRow}>
                  Satiation: {Math.round(minimapTooltip.mob.satiation)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div className={styles.controls}></div>
      <GhostInventory />
    </div>
  );
}
