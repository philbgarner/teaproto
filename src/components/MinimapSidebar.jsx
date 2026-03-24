import { useEffect } from "react";
import SettingsTabs from "../SettingsTabs";
import { drawMinimap } from "../utils/minimap";

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
 *   settingsProps: object,
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
  setShowTempTint,
  dungeonWidth,
  dungeonHeight,
  camera,
  passagesRef,
  exploredMaskRef,
  settingsProps,
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
    <div
      style={{
        width: 220,
        borderLeft: "1px solid #333",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11, color: "#888" }}>Minimap</span>
      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={minimapRef}
          width={196}
          height={196}
          style={{
            imageRendering: "pixelated",
            border: "1px solid #444",
            display: "block",
          }}
          onMouseMove={onMinimapMouseMove}
          onMouseLeave={() => setMinimapTooltip(null)}
        />
        {minimapTooltip && (
          <div
            style={{
              position: "absolute",
              ...(minimapTooltip.canvasX > 98
                ? { right: 196 - minimapTooltip.canvasX + 8, left: "auto" }
                : { left: minimapTooltip.canvasX + 8 }),
              top: minimapTooltip.canvasY - 8,
              background: "rgba(0,0,0,0.88)",
              border: `1px solid ${minimapTooltip.mob.cssColor}`,
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 11,
              color: "#eee",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <div
              style={{ fontWeight: "bold", color: minimapTooltip.mob.cssColor }}
            >
              {minimapTooltip.mob.name}
            </div>
            {minimapTooltip.mob.isXp || minimapTooltip.mob.isIngredient ? (
              <div style={{ color: minimapTooltip.mob.cssColor }}>
                Walk here to collect
              </div>
            ) : minimapTooltip.mob.isAdventurer ? (
              <div>
                HP:{" "}
                <span style={{ color: minimapTooltip.mob.cssColor }}>
                  {minimapTooltip.mob.hp}/{minimapTooltip.mob.maxHp}
                </span>
              </div>
            ) : (
              <>
                <div>
                  Status:{" "}
                  <span style={{ color: minimapTooltip.mob.cssColor }}>
                    {minimapTooltip.mob.status}
                  </span>
                </div>
                <div>
                  Satiation: {Math.round(minimapTooltip.mob.satiation)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <label style={{ fontSize: 11, color: "#aaa", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={showTempTint}
          onChange={(e) => setShowTempTint(e.target.checked)}
          style={{ cursor: "pointer" }}
        />
        Temperature tint
      </label>
      <SettingsTabs {...settingsProps} />
      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
        <div>W / ↑ - move forward</div>
        <div>S / ↓ - move back</div>
        <div>A / D - strafe</div>
        <div>Q / E - turn</div>
        <div>I - interact</div>
        <div>F - toggle passage</div>
        <div>. (period) - Wait a Turn</div>
      </div>
    </div>
  );
}
