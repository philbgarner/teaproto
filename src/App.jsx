import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { generateBspDungeon } from "../mazetools/src/bsp";
import { generateContent } from "../mazetools/src/content";
import { buildTileAtlas } from "../mazetools/src/rendering/tileAtlas";
import { PerspectiveDungeonView } from "../mazetools/src/rendering/PerspectiveDungeonView";
import { RECIPES } from "./tea";

import "./App.css";

// ---------------------------------------------------------------------------
// Tile atlas
// ---------------------------------------------------------------------------
const TILE_PX = 16;
const TILE_SIZE = 3;
const CEILING_H = 3;
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
// Stove 3-D object (1x1 cube textured with 'S')
// ---------------------------------------------------------------------------
function makeStoveProto() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 58, 58);
  ctx.fillStyle = "#ff9900";
  ctx.font = "bold 44px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("S", 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const size = TILE_SIZE * 0.7;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ map: tex });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------------------
// Mob sprite atlas (simple canvas glyph)
// ---------------------------------------------------------------------------
function makeMobSpriteAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(32, 28, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("M", 32, 28);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return { texture: tex, columns: 1, rows: 1 };
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

function drawMinimap(
  canvas,
  solidData,
  width,
  height,
  playerX,
  playerZ,
  yaw,
  mobs,
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

// ---------------------------------------------------------------------------
// Camera hook — grid-locked movement with lerp animation
// ---------------------------------------------------------------------------
const LERP_DURATION_MS = 150;

function useEotBCamera(
  solidData,
  width,
  height,
  startX,
  startZ,
  { onStep, blocked } = {},
) {
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
  const onStepRef = useRef(onStep);
  const blockedRef = useRef(blocked);

  useEffect(() => {
    solidRef.current = solidData;
  }, [solidData]);
  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);
  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);

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
      if (blockedRef.current) return;
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

      function beginAnim(toX, toZ, toYaw, isMove) {
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
        if (isMove) onStepRef.current?.();
      }

      if (e.code === "KeyW" || e.code === "ArrowUp") {
        e.preventDefault();
        const ngx = gx + fdx,
          ngz = gz + fdz;
        if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw, true);
      } else if (e.code === "KeyS" || e.code === "ArrowDown") {
        e.preventDefault();
        const ngx = gx - fdx,
          ngz = gz - fdz;
        if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw, true);
      } else if (e.code === "KeyA") {
        e.preventDefault();
        beginAnim(x, z, yaw + Math.PI / 2, false);
      } else if (e.code === "KeyD") {
        e.preventDefault();
        beginAnim(x, z, yaw - Math.PI / 2, false);
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

  return { camera, logicalRef };
}

// ---------------------------------------------------------------------------
// HandDisplay
// ---------------------------------------------------------------------------
function HandDisplay({ label, tea }) {
  if (!tea) {
    return (
      <div style={{ color: "#555" }}>
        <span style={{ color: "#777" }}>{label}:</span> empty
      </div>
    );
  }
  const [lo, hi] = tea.recipe.idealTemperatureRange;
  const tempColor = tea.ruined
    ? "#f44"
    : tea.temperature > hi
      ? "#f80"
      : "#4f4";
  const tempLabel = tea.ruined
    ? "(RUINED)"
    : tea.temperature > hi
      ? "(too hot)"
      : "(ideal)";
  return (
    <div>
      <span style={{ color: "#777" }}>{label}:</span>{" "}
      <span style={{ color: tea.ruined ? "#f44" : "#fa0" }}>{tea.name}</span>{" "}
      <span style={{ color: tempColor }}>
        {tea.temperature}° {tempLabel}
      </span>
      <span style={{ color: "#555", fontSize: 11 }}>
        {" "}
        [{lo}–{hi}°]
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DUNGEON_SEED = 42;
const DUNGEON_W = 42;
const DUNGEON_H = 42;
const MOB_NAMES = ["Weary Traveler", "Village Elder", "Mysterious Stranger"];

const STATUS_RGB = {
  ecstatic: [0.8, 0.2, 1.0],
  gasping: [1.0, 0.1, 0.1],
  thirsty: [1.0, 0.9, 0.0],
  sated: [0.0, 0.5, 1.0],
  refreshed: [0.2, 1.0, 0.3],
};
const STATUS_CSS = {
  ecstatic: "#c3f",
  gasping: "#f22",
  thirsty: "#fe0",
  sated: "#08f",
  refreshed: "#3f5",
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const dungeon = useMemo(
    () =>
      generateBspDungeon({
        width: DUNGEON_W,
        height: DUNGEON_H,
        seed: DUNGEON_SEED,
        minLeafSize: 6,
        maxLeafSize: 14,
        minRoomSize: 3,
        maxRoomSize: 7,
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

  // Stove placements via generateContent — 2 stoves in end room at distanceToWall === 1
  const stovePlacements = useMemo(() => {
    let count = 0;
    const { objects } = generateContent(dungeon, {
      seed: DUNGEON_SEED + 7,
      callback: ({ x, y, masks, emit }) => {
        if (count >= 2) return;
        if (masks.getRegionId(x, y) !== dungeon.endRoomId) return;
        if (masks.getSolid(x, y) === "wall") return;
        if (masks.getDistanceToWall(x, y) !== 1) return;
        // Skip cells adjacent to a corridor (doorway/entrance)
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        const nearCorridor = neighbors.some(
          ([nx, nz]) =>
            masks.getSolid(nx, nz) !== "wall" &&
            masks.getRegionId(nx, nz) === 0,
        );
        if (nearCorridor) return;
        emit.object({ x, z: y, type: "stove" });
        count++;
      },
    });
    return objects;
  }, [dungeon]);

  // Object registry and world placements
  const stoveProto = useMemo(() => makeStoveProto(), []);
  const objectRegistry = useMemo(
    () => ({ stove: () => stoveProto.clone(true) }),
    [stoveProto],
  );
  const objects = useMemo(() => {
    const halfH = (TILE_SIZE * 0.7) / 2;
    return stovePlacements.map((s) => ({ ...s, offsetY: halfH }));
  }, [stovePlacements]);

  // Passive mobs — one per non-end room (up to 3)
  const initialMobs = useMemo(() => {
    const mobs = [];
    let idx = 0;
    for (const [roomId, room] of dungeon.rooms) {
      if (roomId === dungeon.endRoomId || idx >= MOB_NAMES.length) continue;
      mobs.push({
        id: `mob_${idx}`,
        x: Math.floor(room.rect.x + room.rect.w / 2),
        z: Math.floor(room.rect.y + room.rect.h / 2),
        name: MOB_NAMES[idx],
        preferredRecipeId: RECIPES[(idx * 3 + 1) % RECIPES.length].id,
      });
      idx++;
    }
    return mobs;
  }, [dungeon]);

  const mobSpriteAtlas = useMemo(() => makeMobSpriteAtlas(), []);

  // Tile atlas + texture
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

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const [playerHands, setPlayerHands] = useState({ left: null, right: null });
  const [mobSatiations, setMobSatiations] = useState(() =>
    initialMobs.map(() => 40),
  );
  const mobStatuses = useMemo(
    () =>
      mobSatiations.map((s) =>
        s > 100
          ? "ecstatic"
          : s >= 75
            ? "refreshed"
            : s >= 50
              ? "sated"
              : s >= 25
                ? "thirsty"
                : "gasping",
      ),
    [mobSatiations],
  );
  const mobiles = useMemo(
    () =>
      initialMobs.map((m, i) => ({
        x: m.x,
        z: m.z,
        type: "mob",
        tileId: 0,
        color: STATUS_RGB[mobStatuses[i]] ?? STATUS_RGB.thirsty,
      })),
    [initialMobs, mobStatuses],
  );
  // stoveStates: Map<"x_z", { brewing: null | { recipe, stepsRemaining, ready } }>
  const [stoveStates, setStoveStates] = useState(() => new Map());
  const [showRecipeMenu, setShowRecipeMenu] = useState(false);
  const [activeStoveKey, setActiveStoveKey] = useState(null);
  const [message, setMessage] = useState(null);
  const messageTimerRef = useRef(null);
  const ruinedNotifiedRef = useRef(new Set());
  const [tempDropPerStep, setTempDropPerStep] = useState(0.5);
  const [satiationDropPerStep, setSatiationDropPerStep] = useState(0.1);
  const [supersatiationBonus, setSupersatiationBonus] = useState(50);

  const showMsg = useCallback((text) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(null), 5000);
  }, []);

  // On each player step: cool tea in hands, count down brewing
  const onStep = useCallback(() => {
    setPlayerHands((prev) => {
      let changed = false;
      const next = { left: prev.left, right: prev.right };
      for (const hand of ["left", "right"]) {
        const tea = next[hand];
        if (!tea || tea.ruined) continue;
        const newTemp = tea.temperature - tempDropPerStep;
        const ruined = newTemp < tea.recipe.idealTemperatureRange[0];
        next[hand] = { ...tea, temperature: newTemp, ruined };
        changed = true;
      }
      return changed ? next : prev;
    });
    setStoveStates((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [key, state] of next) {
        if (!state.brewing || state.brewing.ready) continue;
        const steps = state.brewing.stepsRemaining - 1;
        if (steps <= 0) {
          next.set(key, {
            brewing: { ...state.brewing, stepsRemaining: 0, ready: true },
          });
        } else {
          next.set(key, {
            brewing: { ...state.brewing, stepsRemaining: steps },
          });
        }
        changed = true;
      }
      return changed ? new Map(next) : prev;
    });
    setMobSatiations((prev) =>
      prev.map((s) => Math.max(0, s - satiationDropPerStep)),
    );
  }, [tempDropPerStep, satiationDropPerStep]);

  // Show message when tea becomes ruined
  useEffect(() => {
    for (const hand of ["left", "right"]) {
      const tea = playerHands[hand];
      if (tea?.ruined && !ruinedNotifiedRef.current.has(tea.id)) {
        ruinedNotifiedRef.current.add(tea.id);
        showMsg(`Your ${tea.name} has gone cold and is ruined!`);
      }
    }
  }, [playerHands, showMsg]);

  const { camera, logicalRef } = useEotBCamera(
    solidData,
    DUNGEON_W,
    DUNGEON_H,
    spawnX,
    spawnZ,
    { onStep, blocked: showRecipeMenu },
  );

  // Detect what the player is facing (uses logical position for immediate response)
  // camera is a dep to force recompute after each move/turn
  const facingTarget = useMemo(() => {
    const { x, z, yaw } = logicalRef.current;
    const gx = Math.floor(x);
    const gz = Math.floor(z);
    const fdx = Math.round(-Math.sin(yaw));
    const fdz = Math.round(-Math.cos(yaw));
    const tx = gx + fdx;
    const tz = gz + fdz;
    const si = stovePlacements.findIndex((s) => s.x === tx && s.z === tz);
    if (si !== -1) {
      return {
        type: "stove",
        stoveKey: `${stovePlacements[si].x}_${stovePlacements[si].z}`,
      };
    }
    const mi = initialMobs.findIndex((m) => m.x === tx && m.z === tz);
    if (mi !== -1) return { type: "mob", mobIdx: mi };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, stovePlacements, initialMobs]);

  // Interaction prompt text
  const promptText = useMemo(() => {
    if (!facingTarget) return null;
    if (facingTarget.type === "stove") {
      const state = stoveStates.get(facingTarget.stoveKey);
      if (!state?.brewing) return "Stove — Press I to brew tea";
      if (state.brewing.ready)
        return `${state.brewing.recipe.name} is ready! — Press I to collect`;
      return `Brewing ${state.brewing.recipe.name}: ${state.brewing.stepsRemaining} steps — Press I for status`;
    }
    const mob = initialMobs[facingTarget.mobIdx];
    const preferredRecipe = RECIPES.find(
      (r) => r.id === mob?.preferredRecipeId,
    );
    return `${mob?.name} [prefers ${preferredRecipe?.name ?? "?"}] — Press I to offer tea`;
  }, [facingTarget, stoveStates, initialMobs]);

  // I key — interact / recipe menu navigation
  useEffect(() => {
    const onKey = (e) => {
      if (showRecipeMenu) {
        if (e.code === "KeyI" || e.code === "Escape") {
          e.preventDefault();
          setShowRecipeMenu(false);
          return;
        }
        const num = parseInt(e.key);
        if (num >= 1 && num <= RECIPES.length) {
          e.preventDefault();
          const recipe = RECIPES[num - 1];
          setStoveStates((prev) => {
            const next = new Map(prev);
            next.set(activeStoveKey, {
              brewing: {
                recipe,
                stepsRemaining: recipe.timeToBrew,
                ready: false,
              },
            });
            return next;
          });
          setShowRecipeMenu(false);
          showMsg(
            `Started brewing ${recipe.name}! ${recipe.timeToBrew} steps until ready.`,
          );
        }
        return;
      }

      if (e.code === "Period") {
        e.preventDefault();
        onStep();
        return;
      }

      if (e.code !== "KeyI") return;
      e.preventDefault();
      if (!facingTarget) return;

      if (facingTarget.type === "stove") {
        const state = stoveStates.get(facingTarget.stoveKey);
        if (!state?.brewing) {
          setActiveStoveKey(facingTarget.stoveKey);
          setShowRecipeMenu(true);
        } else if (state.brewing.ready) {
          const recipe = state.brewing.recipe;
          const tea = {
            id: crypto.randomUUID(),
            name: recipe.name,
            recipe,
            temperature: recipe.idealTemperatureRange[1] + 15,
            ruined: false,
          };
          const hand = !playerHands.left
            ? "left"
            : !playerHands.right
              ? "right"
              : null;
          if (!hand) {
            showMsg("Your hands are full!");
            return;
          }
          setPlayerHands((prev) => ({ ...prev, [hand]: tea }));
          setStoveStates((prev) => {
            const next = new Map(prev);
            next.delete(facingTarget.stoveKey);
            return next;
          });
          showMsg(`Picked up ${recipe.name}!`);
        } else {
          showMsg(
            `Brewing ${state.brewing.recipe.name}... ${state.brewing.stepsRemaining} steps remaining.`,
          );
        }
      } else if (facingTarget.type === "mob") {
        const mob = initialMobs[facingTarget.mobIdx];
        const hand = playerHands.left
          ? "left"
          : playerHands.right
            ? "right"
            : null;
        const tea = hand ? playerHands[hand] : null;
        const mobStatus = mobStatuses[facingTarget.mobIdx];
        if (tea && (mobStatus === "sated" || mobStatus === "refreshed" || mobStatus === "ecstatic")) {
          showMsg(
            `${mob.name} says: "Oh, I couldn't possibly! I'm far too full right now — perhaps later."`,
          );
          return;
        }
        if (!tea) {
          const preferredRecipe = RECIPES.find(
            (r) => r.id === mob.preferredRecipeId,
          );
          const status = mobStatuses[facingTarget.mobIdx];
          const thirstLine =
            status === "gasping"
              ? "I'm absolutely desperate for something to drink!"
              : status === "thirsty"
                ? "I'm quite parched."
                : status === "sated"
                  ? "I wouldn't mind some tea."
                  : status === "refreshed"
                    ? "I'm doing well, but tea is always welcome."
                    : "I'm fully satisfied, thank you.";
          showMsg(
            `${mob.name} says: "I'd love some ${preferredRecipe?.name ?? "tea"}... ${thirstLine}"`,
          );
          return;
        }
        const [lo, hi] = tea.recipe.idealTemperatureRange;
        setPlayerHands((prev) => ({ ...prev, [hand]: null }));
        if (tea.ruined || tea.temperature < lo) {
          setMobSatiations((prev) => {
            const next = [...prev];
            next[facingTarget.mobIdx] = 10;
            return next;
          });
          showMsg(
            `${mob.name} says: "This ${tea.name} is cold and ruined... How disappointing."`,
          );
        } else if (tea.temperature > hi) {
          setMobSatiations((prev) => {
            const next = [...prev];
            next[facingTarget.mobIdx] = 30;
            return next;
          });
          showMsg(
            `${mob.name} says: "Ouch! This ${tea.name} is scalding hot! Dreadfully disappointing."`,
          );
        } else {
          const isPreferred = mob.preferredRecipeId === tea.recipe.id;
          const baseSatiation = 100;
          const bonus = isPreferred
            ? baseSatiation * (supersatiationBonus / 100)
            : 0;
          setMobSatiations((prev) => {
            const next = [...prev];
            next[facingTarget.mobIdx] = baseSatiation + bonus;
            return next;
          });
          if (isPreferred) {
            showMsg(
              `${mob.name} says: "My favourite! This ${tea.name} is absolutely perfect — I am overjoyed!"`,
            );
          } else {
            showMsg(
              `${mob.name} says: "Ahh, thank you! This ${tea.name} is perfectly brewed — most refreshing!"`,
            );
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    showRecipeMenu,
    facingTarget,
    stoveStates,
    playerHands,
    initialMobs,
    mobStatuses,
    activeStoveKey,
    showMsg,
    onStep,
    supersatiationBonus,
  ]);

  // Minimap
  const minimapRef = useRef(null);
  const [minimapTooltip, setMinimapTooltip] = useState(null);
  const minimapMobs = useMemo(
    () =>
      initialMobs.map((m, i) => ({
        x: m.x,
        z: m.z,
        name: m.name,
        status: mobStatuses[i],
        satiation: mobSatiations[i],
        cssColor: STATUS_CSS[mobStatuses[i]] ?? STATUS_CSS.thirsty,
      })),
    [initialMobs, mobStatuses, mobSatiations],
  );

  const onMinimapMouseMove = useCallback(
    (e) => {
      const canvas = minimapRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cellW = canvas.width / DUNGEON_W;
      const cellH = canvas.height / DUNGEON_H;
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
    [minimapMobs],
  );
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
      minimapMobs,
    );
  }, [solidData, camera, minimapMobs]);

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
          <span style={{ fontWeight: "bold", color: "#eee" }}>Tea Dungeon</span>
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
                ceilingHeight={CEILING_H}
                wallTile={TILE_WALL}
                renderRadius={28}
                fov={60}
                fogNear={4}
                fogFar={28}
                tileSize={TILE_SIZE}
                objects={objects}
                objectRegistry={objectRegistry}
                mobiles={mobiles}
                spriteAtlas={mobSpriteAtlas}
                style={{ width: "100%", height: "100%" }}
              />
            )}

            {/* Interaction prompt */}
            {promptText && !showRecipeMenu && (
              <div
                style={{
                  position: "absolute",
                  bottom: 70,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.75)",
                  border: "1px solid #888",
                  padding: "6px 14px",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#ffd",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {promptText}
              </div>
            )}

            {/* Recipe menu */}
            {showRecipeMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(0,0,0,0.93)",
                  border: "1px solid #666",
                  padding: 20,
                  borderRadius: 6,
                  minWidth: 280,
                  color: "#eee",
                  fontFamily: "monospace",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: 12,
                    color: "#fa0",
                    fontSize: 15,
                  }}
                >
                  Select Recipe
                </div>
                {RECIPES.map((recipe, i) => (
                  <div
                    key={recipe.id}
                    onClick={() => {
                      setStoveStates((prev) => {
                        const next = new Map(prev);
                        next.set(activeStoveKey, {
                          brewing: {
                            recipe,
                            stepsRemaining: recipe.timeToBrew,
                            ready: false,
                          },
                        });
                        return next;
                      });
                      setShowRecipeMenu(false);
                      showMsg(
                        `Started brewing ${recipe.name}! ${recipe.timeToBrew} steps until ready.`,
                      );
                    }}
                    style={{
                      padding: "6px 8px",
                      cursor: "pointer",
                      borderRadius: 3,
                      marginBottom: 4,
                      background: "rgba(255,255,255,0.05)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "#fa0" }}>[{i + 1}]</span>{" "}
                    {recipe.name}{" "}
                    <span style={{ color: "#777" }}>
                      ({recipe.timeToBrew} steps,{" "}
                      {recipe.idealTemperatureRange[0]}–
                      {recipe.idealTemperatureRange[1]}°)
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 10, color: "#555", fontSize: 11 }}>
                  Press number to select · I / Esc to cancel
                </div>
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.82)",
                  border: "1px solid #555",
                  padding: "8px 18px",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#fff",
                  maxWidth: 480,
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                {message}
              </div>
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
            <div style={{ position: "relative", display: "inline-block" }}>
              <canvas
                ref={minimapRef}
                width={196}
                height={196}
                style={{ imageRendering: "pixelated", border: "1px solid #444", display: "block" }}
                onMouseMove={onMinimapMouseMove}
                onMouseLeave={() => setMinimapTooltip(null)}
              />
              {minimapTooltip && (
                <div
                  style={{
                    position: "absolute",
                    left: minimapTooltip.canvasX + 8,
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
                  <div style={{ fontWeight: "bold", color: minimapTooltip.mob.cssColor }}>
                    {minimapTooltip.mob.name}
                  </div>
                  <div>
                    Status:{" "}
                    <span style={{ color: minimapTooltip.mob.cssColor }}>
                      {minimapTooltip.mob.status}
                    </span>
                  </div>
                  <div>Satiation: {Math.round(minimapTooltip.mob.satiation)}</div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              <div style={{ marginBottom: 2 }}>
                Cooling: {tempDropPerStep.toFixed(2)}°/step
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={tempDropPerStep}
                onChange={(e) => setTempDropPerStep(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              <div style={{ marginBottom: 2 }}>
                Satiation loss: {satiationDropPerStep.toFixed(1)}/step
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={satiationDropPerStep}
                onChange={(e) =>
                  setSatiationDropPerStep(parseFloat(e.target.value))
                }
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              <div style={{ marginBottom: 2 }}>
                Preference bonus: {supersatiationBonus}%
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={supersatiationBonus}
                onChange={(e) =>
                  setSupersatiationBonus(parseInt(e.target.value))
                }
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
              <div>W / ↑ - move forward</div>
              <div>S / ↓ - move back</div>
              <div>A - turn left</div>
              <div>D - turn right</div>
              <div>I - interact</div>
              <div>. (period) - Wait a Turn</div>
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

      {/* Hands HUD */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 220,
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "rgba(0,0,0,0.88)",
          borderTop: "1px solid #333",
          fontFamily: "monospace",
          fontSize: 13,
          pointerEvents: "none",
        }}
      >
        <HandDisplay label="Left Hand" tea={playerHands.left} />
        <HandDisplay label="Right Hand" tea={playerHands.right} />
      </div>
    </>
  );
}
