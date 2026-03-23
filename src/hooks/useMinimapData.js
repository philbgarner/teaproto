import { useCallback, useRef, useState } from "react";

/**
 * Manages minimap interaction state: the canvas ref, hover tooltip, and mouse
 * move handler. The `minimapMobs` array (already containing `x`, `z`, and
 * `cssColor` fields) is passed in so this hook stays decoupled from game
 * state concerns.
 *
 * @param {object[]} minimapMobs - Mob/drop entries with `{ x, z, cssColor, ... }`.
 * @param {number} dungeonWidth  - Width of the dungeon in tiles.
 * @param {number} dungeonHeight - Height of the dungeon in tiles.
 * @returns {{
 *   minimapRef: React.RefObject<HTMLCanvasElement>,
 *   minimapTooltip: object|null,
 *   setMinimapTooltip: (t: object|null) => void,
 *   onMinimapMouseMove: (e: MouseEvent) => void,
 * }}
 *
 * @example
 * const { minimapRef, minimapTooltip, setMinimapTooltip, onMinimapMouseMove } =
 *   useMinimapData(minimapMobs, dungeonWidth, dungeonHeight);
 *
 * return (
 *   <canvas
 *     ref={minimapRef}
 *     onMouseMove={onMinimapMouseMove}
 *     onMouseLeave={() => setMinimapTooltip(null)}
 *   />
 * );
 */
export function useMinimapData(minimapMobs, dungeonWidth, dungeonHeight) {
  const minimapRef = useRef(null);
  const [minimapTooltip, setMinimapTooltip] = useState(null);

  const onMinimapMouseMove = useCallback(
    (e) => {
      const canvas = minimapRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cellW = canvas.width / dungeonWidth;
      const cellH = canvas.height / dungeonHeight;
      const hitRadius = Math.max(cellW * 1.2, 5);
      for (const mob of minimapMobs) {
        const cx = (mob.x + 0.5) * cellW * (rect.width / canvas.width);
        const cz = (mob.z + 0.5) * cellH * (rect.height / canvas.height);
        if (Math.hypot(mx - cx, my - cz) <= hitRadius) {
          setMinimapTooltip({ mob, canvasX: cx, canvasY: cz });
          return;
        }
      }
      setMinimapTooltip(null);
    },
    [minimapMobs, dungeonWidth, dungeonHeight],
  );

  return { minimapRef, minimapTooltip, setMinimapTooltip, onMinimapMouseMove };
}
