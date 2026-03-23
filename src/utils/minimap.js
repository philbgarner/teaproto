/**
 * Draws the dungeon minimap onto a canvas element.
 *
 * Renders floor/wall tiles, hidden passages (cyan when enabled, dark when
 * hidden), mob dots, and a player arrow indicator.
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
      const solid = solidData[cz * width + cx] > 0;
      ctx.fillStyle = solid ? "#333" : "#888";
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
    for (const mob of mobs) {
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
