import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { generateBspDungeon } from "../mazetools/src/bsp";
import { buildTileAtlas } from "../mazetools/src/rendering/tileAtlas";
import { PerspectiveDungeonView } from "../mazetools/src/rendering/PerspectiveDungeonView";

import "./App.css";

// ---------------------------------------------------------------------------
// Tile atlas — padded sheet: tiles are 16×16 px, first tile at (16,16),
// step = 24px (16px tile + 8px gap). Repacked into a clean 3×1 atlas.
// ---------------------------------------------------------------------------
const TILE_PX = 16;
const SRC_FLOOR = { x: 136, y: 328 };
const SRC_CEILING = { x: 136, y: 400 };
const SRC_WALL = { x: 208, y: 304 };

const TILE_FLOOR = 0;
const TILE_CEILING = 1;
const TILE_WALL = 2;

function loadRepackedAtlasTexture(sources) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = TILE_PX * sources.length;
      canvas.height = TILE_PX;
      const ctx = canvas.getContext("2d");
      sources.forEach(({ x, y }, i) => {
        ctx.drawImage(
          img,
          x,
          y,
          TILE_PX,
          TILE_PX,
          i * TILE_PX,
          0,
          TILE_PX,
          TILE_PX,
        );
      });
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      resolve(tex);
    };
    img.onerror = reject;
    img.src = "/examples/eotb/tileset.png";
  });
}

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function cardinalDir(yaw) {
  const norm = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const idx = Math.round((norm / (Math.PI * 2)) * 8) % 8;
  return DIRS[idx];
}

function drawMinimap(canvas, solidData, width, height, playerX, playerZ, yaw) {
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

// ---------------------------------------------------------------------------
// Camera hook — grid-locked movement with lerp animation
// ---------------------------------------------------------------------------
const LERP_DURATION_MS = 150;

function useEotBCamera(solidData, width, height, startX, startZ) {
  const logicalRef = useRef({ x: startX, z: startZ, yaw: 0 });
  const animRef = useRef({
    fromX: startX,
    fromZ: startZ,
    fromYaw: 0,
    toX: startX,
    toZ: startZ,
    toYaw: 0,
    startTime: 0,
    animating: false,
  });
  const [camera, setCamera] = useState(() => ({
    x: startX,
    z: startZ,
    yaw: 0,
  }));
  const solidRef = useRef(solidData);

  useEffect(() => {
    solidRef.current = solidData;
  }, [solidData]);

  useEffect(() => {
    logicalRef.current = { x: startX, z: startZ, yaw: 0 };
    animRef.current = {
      fromX: startX,
      fromZ: startZ,
      fromYaw: 0,
      toX: startX,
      toZ: startZ,
      toYaw: 0,
      startTime: 0,
      animating: false,
    };
  }, [startX, startZ]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (animRef.current.animating) return;
      const { x, z, yaw } = logicalRef.current;
      const solid = solidRef.current;
      const fdx = Math.round(-Math.sin(yaw));
      const fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x);
      const gz = Math.floor(z);

      function walkable(cx, cz) {
        if (!solid) return false;
        if (cx < 0 || cz < 0 || cx >= width || cz >= height) return false;
        return solid[cz * width + cx] === 0;
      }

      function beginAnim(toX, toZ, toYaw) {
        animRef.current = {
          fromX: x,
          fromZ: z,
          fromYaw: yaw,
          toX,
          toZ,
          toYaw,
          startTime: performance.now(),
          animating: true,
        };
        logicalRef.current = { x: toX, z: toZ, yaw: toYaw };
      }

      if (e.code === "KeyW" || e.code === "ArrowUp") {
        e.preventDefault();
        const ngx = gx + fdx,
          ngz = gz + fdz;
        if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw);
      } else if (e.code === "KeyS" || e.code === "ArrowDown") {
        e.preventDefault();
        const ngx = gx - fdx,
          ngz = gz - fdz;
        if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw);
      } else if (e.code === "KeyA") {
        e.preventDefault();
        beginAnim(x, z, yaw + Math.PI / 2);
      } else if (e.code === "KeyD") {
        e.preventDefault();
        beginAnim(x, z, yaw - Math.PI / 2);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [width, height]);

  useEffect(() => {
    let rafId;
    const tick = (now) => {
      rafId = requestAnimationFrame(tick);
      const anim = animRef.current;
      if (!anim.animating) return;
      const t = Math.min((now - anim.startTime) / LERP_DURATION_MS, 1);
      const s = t * t * (3 - 2 * t);
      setCamera({
        x: anim.fromX + (anim.toX - anim.fromX) * s,
        z: anim.fromZ + (anim.toZ - anim.fromZ) * s,
        yaw: anim.fromYaw + (anim.toYaw - anim.fromYaw) * s,
      });
      if (t >= 1) animRef.current.animating = false;
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return camera;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const DUNGEON_SEED = 42;
const DUNGEON_W = 42;
const DUNGEON_H = 42;

export default function App() {
  const dungeon = useMemo(
    () =>
      generateBspDungeon({
        width: DUNGEON_W,
        height: DUNGEON_H,
        seed: DUNGEON_SEED,
        minLeafSize: 6, // default: 12
        maxLeafSize: 14, // default: 28
        minRoomSize: 3, // default: 5
        maxRoomSize: 7, // default: 14
      }),
    [],
  );

  const solidData = useMemo(() => dungeon.textures.solid.image.data, [dungeon]);

  const { spawnX, spawnZ } = useMemo(() => {
    const room = dungeon.rooms.get(dungeon.endRoomId);
    if (!room) return { spawnX: 1.5, spawnZ: 1.5 };
    return {
      spawnX: room.rect.x + Math.floor(room.rect.w / 2) + 0.5,
      spawnZ: room.rect.y + Math.floor(room.rect.h / 2) + 0.5,
    };
  }, [dungeon]);

  const atlas = useMemo(
    () => buildTileAtlas(TILE_PX * 3, TILE_PX, TILE_PX, TILE_PX),
    [],
  );
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    loadRepackedAtlasTexture([SRC_FLOOR, SRC_CEILING, SRC_WALL]).then(
      setTexture,
    );
  }, []);

  const camera = useEotBCamera(solidData, DUNGEON_W, DUNGEON_H, spawnX, spawnZ);

  const minimapRef = useRef(null);
  useEffect(() => {
    if (!minimapRef.current) return;
    drawMinimap(
      minimapRef.current,
      solidData,
      DUNGEON_W,
      DUNGEON_H,
      camera.x,
      camera.z,
      camera.yaw,
    );
  }, [solidData, camera]);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100vw",
          height: "100vh",
          background: "#000",
          color: "#ccc",
          fontFamily: "monospace",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 40,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 16,
            borderBottom: "1px solid #333",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: "bold", color: "#eee" }}>
            Dungeon Crawler
          </span>
          <span style={{ color: "#666", fontSize: 12 }}>
            seed: {DUNGEON_SEED}
          </span>
        </div>

        {/* Main area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 3D view */}
          <div style={{ flex: 1, position: "relative" }}>
            {texture && (
              <PerspectiveDungeonView
                solidData={solidData}
                width={DUNGEON_W}
                height={DUNGEON_H}
                cameraX={camera.x}
                cameraZ={camera.z}
                yaw={camera.yaw}
                atlas={atlas}
                texture={texture}
                floorTile={TILE_FLOOR}
                ceilingTile={TILE_CEILING}
                ceilingHeight={3}
                wallTile={TILE_WALL}
                renderRadius={28}
                fov={60}
                fogNear={4}
                fogFar={28}
                tileSize={3}
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>

          {/* Minimap sidebar */}
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
            <canvas
              ref={minimapRef}
              width={196}
              height={196}
              style={{ imageRendering: "pixelated", border: "1px solid #444" }}
            />
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
              <div>W / ↑ — move forward</div>
              <div>S / ↓ — move back</div>
              <div>A — turn left</div>
              <div>D — turn right</div>
            </div>
          </div>
        </div>

        {/* Status bar */}
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
          <span>Facing: {cardinalDir(camera.yaw)}</span>
        </div>
      </div>
      <div id="leftHand">
        <span>Left Hand</span>
        <span>nothing</span>
      </div>

      <div id="rightHand">
        <span>Right Hand</span>
        <span>nothing</span>
      </div>
    </>
  );
}
