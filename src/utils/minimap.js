/**
 * Returns an rgb CSS string for a floor cell tinted by temperature.
 * temp 0 → cool blue, 127 → neutral grey (#888), 255 → warm orange-red.
 */
function tempTintColor(temp) {
  const t = temp / 255; // 0..1
  const neutral = 0x88;
  let r, g, b;
  if (t < 0.5) {
    // cool: blend from blue (0,100,200) toward neutral (136,136,136)
    const f = t * 2; // 0..1
    r = Math.round(0 + (neutral - 0) * f);
    g = Math.round(100 + (neutral - 100) * f);
    b = Math.round(200 + (neutral - 200) * f);
  } else {
    // warm: blend from neutral (136,136,136) toward orange-red (220,80,30)
    const f = (t - 0.5) * 2; // 0..1
    r = Math.round(neutral + (220 - neutral) * f);
    g = Math.round(neutral + (80 - neutral) * f);
    b = Math.round(neutral + (30 - neutral) * f);
  }
  return `rgb(${r},${g},${b})`;
}

/**
 * Draws the dungeon minimap onto a canvas element.
 *
 * Renders floor/wall tiles, hidden passages (cyan when enabled, dark when
 * hidden), mob dots, and a player arrow indicator.
 *
 * @param {Uint8Array|null} exploredMask - Per-cell explored flag (1=explored).
 *   When provided, only explored cells are rendered; unexplored cells stay dark.
 */
export function drawMinimap(
  canvas,
  solidData,
  width,
  height,
  playerX,
  playerZ,
  yaw,
  mobs,
  passages,
  temperatureData,
  exploredMask,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  const cellW = cw / width;
  const cellH = ch / height;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, cw, ch);
  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const i = cz * width + cx;
      const solid = solidData[i] > 0;
      if (solid) {
        // Wall is visible if it borders an explored floor cell
        if (!exploredMask) {
          ctx.fillStyle = "#333";
        } else {
          const visible =
            (cx > 0 && !solidData[i - 1] && exploredMask[i - 1]) ||
            (cx + 1 < width && !solidData[i + 1] && exploredMask[i + 1]) ||
            (cz > 0 && !solidData[i - width] && exploredMask[i - width]) ||
            (cz + 1 < height && !solidData[i + width] && exploredMask[i + width]);
          ctx.fillStyle = visible ? "#333" : "#111";
        }
      } else if (exploredMask && !exploredMask[i]) {
        ctx.fillStyle = "#111";
      } else if (temperatureData) {
        ctx.fillStyle = tempTintColor(temperatureData[i]);
      } else {
        ctx.fillStyle = "#888";
      }
      ctx.fillRect(cx * cellW, cz * cellH, cellW, cellH);
    }
  }
  if (passages) {
    for (const p of passages) {
      ctx.fillStyle = p.enabled ? "#00ffff" : "#006666";
      for (const cell of p.cells) {
        ctx.fillRect(cell.x * cellW, cell.y * cellH, cellW, cellH);
      }
    }
  }
  if (mobs) {
    const isExplored = (x, z) =>
      !exploredMask || exploredMask[z * width + x];
    // Draw adventurer debug paths first (behind dots)
    for (const mob of mobs) {
      if (!mob.isAdventurer || !mob.debugPath || mob.debugPath.length === 0) continue;
      if (!isExplored(mob.x, mob.z)) continue;
      ctx.strokeStyle = mob.cssColor + "88";
      ctx.lineWidth = Math.max(cellW * 0.3, 1);
      ctx.setLineDash([cellW * 0.5, cellW * 0.5]);
      ctx.beginPath();
      ctx.moveTo((mob.x + 0.5) * cellW, (mob.z + 0.5) * cellH);
      for (const step of mob.debugPath) {
        ctx.lineTo((step.x + 0.5) * cellW, (step.z + 0.5) * cellH);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const mob of mobs) {
      if (!isExplored(mob.x, mob.z)) continue;
      ctx.fillStyle = mob.cssColor;
      ctx.beginPath();
      ctx.arc(
        (mob.x + 0.5) * cellW,
        (mob.z + 0.5) * cellH,
        Math.max(cellW * 0.7, 3),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  const px = playerX * cellW;
  const pz = playerZ * cellH;
  const arrowLen = Math.max(cellW * 2, 6);
  ctx.fillStyle = "#f80";
  ctx.beginPath();
  ctx.arc(px, pz, Math.max(cellW * 0.6, 3), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ff0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, pz);
  ctx.lineTo(px - Math.sin(yaw) * arrowLen, pz - Math.cos(yaw) * arrowLen);
  ctx.stroke();
}
