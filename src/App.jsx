import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { generateBspDungeon } from "../mazetools/src/bsp";
import { generateContent } from "../mazetools/src/content";
import { buildTileAtlas } from "../mazetools/src/rendering/tileAtlas";
import { PerspectiveDungeonView } from "../mazetools/src/rendering/PerspectiveDungeonView";
import { RECIPES } from "./tea";
import SettingsTabs from "./SettingsTabs";

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
    img.src = `${import.meta.env.BASE_URL}examples/eotb/tileset.png`;
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
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Stove", 32, 32);
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
// Mob + Adventurer sprite atlas (2 columns: col 0 = mob, col 1 = adventurer)
// ---------------------------------------------------------------------------
function makeMobSpriteAtlas() {
  const TILE = 64;
  const canvas = document.createElement("canvas");
  canvas.width = TILE * 2;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Col 0 — friendly mob (circle + "M")
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(32, 28, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("M", 32, 28);

  // Col 1 — adventurer (circle + "A")
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(TILE + 32, 28, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", TILE + 32, 28);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return { texture: tex, columns: 2, rows: 1 };
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

function greedyStepToward(ax, az, tx, tz, walkableFn, occupiedFn) {
  const dx = tx - ax;
  const dz = tz - az;
  if (dx === 0 && dz === 0) return null;
  const moves =
    Math.abs(dx) >= Math.abs(dz)
      ? [
          [Math.sign(dx), 0],
          [0, Math.sign(dz)],
          [0, -Math.sign(dz)],
          [-Math.sign(dx), 0],
        ]
      : [
          [0, Math.sign(dz)],
          [Math.sign(dx), 0],
          [-Math.sign(dx), 0],
          [0, -Math.sign(dz)],
        ];
  for (const [ddx, ddz] of moves) {
    if (ddx === 0 && ddz === 0) continue;
    const nx = ax + ddx;
    const nz = az + ddz;
    if (walkableFn(nx, nz) && !occupiedFn(nx, nz)) return { x: nx, z: nz };
  }
  return null;
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
    setCamera({ x: startX, z: startZ, yaw: 0 });
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
const DUNGEON_W = 32;
const DUNGEON_H = DUNGEON_W;
const MOB_NAMES = ["Skeleton", "Goblin", "Troll"];

const TURNS_PER_WAVE = 120;
const WAVE_COUNTDOWN_THRESHOLD = 20;
const PLAYER_MAX_HP = 30;
const PLAYER_DEFENSE = 2;
const MOB_ATTACK = 3;
const MOB_DEFENSE = 1;

const ADVENTURER_TYPES = [
  {
    type: "warrior",
    name: "Warrior",
    hp: 20,
    attack: 5,
    defense: 2,
    xp: 30,
    colorRgb: [1.0, 0.15, 0.15],
  },
  {
    type: "rogue",
    name: "Rogue",
    hp: 12,
    attack: 7,
    defense: 1,
    xp: 25,
    colorRgb: [0.9, 0.1, 0.9],
  },
  {
    type: "mage",
    name: "Mage",
    hp: 10,
    attack: 9,
    defense: 0,
    xp: 40,
    colorRgb: [0.2, 0.3, 1.0],
  },
];

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
  const [dungeonSeed, setDungeonSeed] = useState(DUNGEON_SEED);
  const [dungeonWidth, setDungeonWidth] = useState(DUNGEON_W);
  const [dungeonHeight, setDungeonHeight] = useState(DUNGEON_H);
  const [minLeafSize, setMinLeafSize] = useState(6);
  const [maxLeafSize, setMaxLeafSize] = useState(14);
  const [minRoomSize, setMinRoomSize] = useState(3);
  const [maxRoomSize, setMaxRoomSize] = useState(7);

  const dungeon = useMemo(
    () =>
      generateBspDungeon({
        width: dungeonWidth,
        height: dungeonHeight,
        seed: dungeonSeed,
        minLeafSize,
        maxLeafSize,
        minRoomSize,
        maxRoomSize,
      }),
    [
      dungeonSeed,
      dungeonWidth,
      dungeonHeight,
      minLeafSize,
      maxLeafSize,
      minRoomSize,
      maxRoomSize,
    ],
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
        attack: MOB_ATTACK,
        defense: MOB_DEFENSE,
      });
      idx++;
    }
    return mobs;
  }, [dungeon]);

  // Rooms sorted farthest-first from player spawn — used for adventurer spawning
  const adventurerSpawnRooms = useMemo(() => {
    const endRoom = dungeon.rooms.get(dungeon.endRoomId);
    const endCx = endRoom ? endRoom.rect.x + endRoom.rect.w / 2 : 0;
    const endCz = endRoom ? endRoom.rect.y + endRoom.rect.h / 2 : 0;
    return Array.from(dungeon.rooms.entries())
      .filter(([id]) => id !== dungeon.endRoomId)
      .map(([, room]) => ({
        x: Math.floor(room.rect.x + room.rect.w / 2),
        z: Math.floor(room.rect.y + room.rect.h / 2),
        dist: Math.hypot(
          room.rect.x + room.rect.w / 2 - endCx,
          room.rect.y + room.rect.h / 2 - endCz,
        ),
      }))
      .sort((a, b) => b.dist - a.dist);
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
  // stoveStates: Map<"x_z", { brewing: null | { recipe, stepsRemaining, ready } }>
  const [stoveStates, setStoveStates] = useState(() => new Map());
  const [showRecipeMenu, setShowRecipeMenu] = useState(false);
  const [activeStoveKey, setActiveStoveKey] = useState(null);
  const [message, setMessage] = useState(null);
  const messageTimerRef = useRef(null);
  const ruinedNotifiedRef = useRef(new Set());
  const [tempDropPerStep, setTempDropPerStep] = useState(0.5);
  const [satiationDropPerStep, setSatiationDropPerStep] = useState(0.5);
  const [supersatiationBonus, setSupersatiationBonus] = useState(50);
  const [turnsPerWave, setTurnsPerWave] = useState(TURNS_PER_WAVE);

  // Wave / combat state
  const [adventurers, setAdventurers] = useState([]);
  const [currentWave, setCurrentWave] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [playerXp, setPlayerXp] = useState(0);
  const [xpDrops, setXpDrops] = useState([]);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);

  // Refs for synchronous cross-state access during game step processing
  const adventurersRef = useRef([]);
  const currentWaveRef = useRef(0);
  const turnCountRef = useRef(0);
  const playerXpRef = useRef(0);
  const xpDropsRef = useRef([]);
  const playerHpRef = useRef(PLAYER_MAX_HP);
  // initialMobs is stable (useMemo on []), so we can read it from a ref too
  const mobSatiationsRef = useRef(null);
  if (mobSatiationsRef.current === null) {
    mobSatiationsRef.current = initialMobs.map(() => 40);
  }

  // Reset all game state whenever the dungeon regenerates
  useEffect(() => {
    const freshSatiations = initialMobs.map(() => 40);
    setPlayerHands({ left: null, right: null });
    setMobSatiations(freshSatiations);
    setStoveStates(new Map());
    setShowRecipeMenu(false);
    setActiveStoveKey(null);
    setMessage(null);
    setAdventurers([]);
    setCurrentWave(0);
    setTurnCount(0);
    setPlayerXp(0);
    setXpDrops([]);
    setPlayerHp(PLAYER_MAX_HP);
    adventurersRef.current = [];
    currentWaveRef.current = 0;
    turnCountRef.current = 0;
    playerXpRef.current = 0;
    xpDropsRef.current = [];
    playerHpRef.current = PLAYER_MAX_HP;
    mobSatiationsRef.current = freshSatiations;
    ruinedNotifiedRef.current = new Set();
  }, [dungeon]); // eslint-disable-line react-hooks/exhaustive-deps

  const mobiles = useMemo(
    () => [
      ...initialMobs.map((m, i) => ({
        x: m.x,
        z: m.z,
        type: "mob",
        tileId: 0,
        color:
          mobSatiations[i] <= 0
            ? [0.25, 0.25, 0.25]
            : (STATUS_RGB[mobStatuses[i]] ?? STATUS_RGB.thirsty),
      })),
      ...adventurers
        .filter((a) => a.alive)
        .map((a) => ({
          x: a.x,
          z: a.z,
          type: "adventurer",
          tileId: 1,
          color: a.colorRgb,
        })),
    ],
    [initialMobs, mobStatuses, mobSatiations, adventurers],
  );

  const showMsg = useCallback((text) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(null), 5000);
  }, []);

  const spawnAdventurersForWave = useCallback(
    (waveNum) => {
      const count = Math.min(1 + waveNum, 6);
      const spawned = [];
      const occupied = new Set(
        adventurersRef.current
          .filter((a) => a.alive)
          .map((a) => `${a.x}_${a.z}`),
      );
      for (let i = 0; i < count; i++) {
        const room =
          adventurerSpawnRooms[i % Math.max(1, adventurerSpawnRooms.length)];
        if (!room) continue;
        const tmpl = ADVENTURER_TYPES[i % ADVENTURER_TYPES.length];
        // offset slightly to avoid stacking
        let spawnX = room.x;
        let spawnZ = room.z + i;
        // clamp to bounds
        spawnX = Math.max(1, Math.min(dungeonWidth - 2, spawnX));
        spawnZ = Math.max(1, Math.min(dungeonHeight - 2, spawnZ));
        const key = `${spawnX}_${spawnZ}`;
        if (occupied.has(key)) {
          spawnZ = Math.max(1, Math.min(dungeonHeight - 2, room.z - i));
        }
        occupied.add(`${spawnX}_${spawnZ}`);
        spawned.push({
          id: `adv_w${waveNum}_${i}`,
          name: tmpl.name,
          x: spawnX,
          z: spawnZ,
          alive: true,
          hp: tmpl.hp + (waveNum - 1) * 3,
          maxHp: tmpl.hp + (waveNum - 1) * 3,
          attack: tmpl.attack + Math.floor((waveNum - 1) / 2),
          defense: tmpl.defense,
          xp: tmpl.xp + (waveNum - 1) * 5,
          template: tmpl.type,
          colorRgb: tmpl.colorRgb,
        });
      }
      return spawned;
    },
    [adventurerSpawnRooms],
  );

  // On each player step: cool tea, count down brewing, run game loop
  const onStep = useCallback(() => {
    // --- Tea cooling ---
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

    // --- Stove brewing countdown ---
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

    // --- Game step processing (uses refs for synchronous cross-state reads) ---
    const newTurnCount = turnCountRef.current + 1;
    turnCountRef.current = newTurnCount;

    let newAdventurers = [...adventurersRef.current];
    let newMobSatiations = mobSatiationsRef.current.map((s) =>
      Math.max(0, s - satiationDropPerStep),
    );
    let newWave = currentWaveRef.current;
    let newPlayerXp = playerXpRef.current;
    let newXpDrops = [...xpDropsRef.current];
    let newPlayerHp = playerHpRef.current;
    let stepMessage = null;

    // --- Wave spawning ---
    if (newTurnCount % turnsPerWave === 0) {
      newWave = Math.floor(newTurnCount / turnsPerWave);
      currentWaveRef.current = newWave;
      const spawned = spawnAdventurersForWave(newWave);
      newAdventurers = [...newAdventurers.filter((a) => a.alive), ...spawned];
      stepMessage = `Wave ${newWave}! ${spawned.length} adventurer${spawned.length !== 1 ? "s" : ""} have entered the dungeon!`;
    }

    // --- XP pickup (before moving to avoid collecting just-dropped XP) ---
    const { x: px, z: pz } = logicalRef.current;
    const pgx = Math.floor(px);
    const pgz = Math.floor(pz);
    const remainingDrops = [];
    let xpGained = 0;
    for (const drop of newXpDrops) {
      if (drop.x === pgx && drop.z === pgz) {
        xpGained += drop.amount;
      } else {
        remainingDrops.push(drop);
      }
    }
    if (xpGained > 0) {
      newPlayerXp += xpGained;
      stepMessage = `Collected ${xpGained} XP! (Total: ${newPlayerXp})`;
    }
    newXpDrops = remainingDrops;

    // --- Adventurer AI ---
    function isWalkable(x, z) {
      if (x < 0 || z < 0 || x >= dungeonWidth || z >= dungeonHeight)
        return false;
      return solidData[z * dungeonWidth + x] === 0;
    }

    // Build occupied set (other adventurers + mob positions + player)
    const occupied = new Set([
      `${pgx}_${pgz}`,
      ...initialMobs.map((m) => `${m.x}_${m.z}`),
    ]);

    newAdventurers = newAdventurers.map((adv) => {
      if (!adv.alive) return adv;

      // Find nearest target: player or nearest conscious mob
      let nearestTarget = { x: pgx, z: pgz, type: "player", idx: -1 };
      let nearestDist = Math.hypot(adv.x - pgx, adv.z - pgz);
      for (let i = 0; i < initialMobs.length; i++) {
        if (newMobSatiations[i] <= 0) continue; // unconscious
        const mob = initialMobs[i];
        const d = Math.hypot(adv.x - mob.x, adv.z - mob.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestTarget = { x: mob.x, z: mob.z, type: "mob", idx: i };
        }
      }

      const ddx = nearestTarget.x - adv.x;
      const ddz = nearestTarget.z - adv.z;
      const adjacent = Math.abs(ddx) + Math.abs(ddz) === 1;

      if (adjacent) {
        // Attack target
        if (nearestTarget.type === "player") {
          const damage = Math.max(1, adv.attack - PLAYER_DEFENSE);
          newPlayerHp = Math.max(0, newPlayerHp - damage);
          stepMessage = `The ${adv.name} attacks you for ${damage} damage! (${newPlayerHp}/${PLAYER_MAX_HP} HP)`;
        } else {
          const damage = Math.max(1, adv.attack - MOB_DEFENSE);
          newMobSatiations[nearestTarget.idx] = Math.max(
            0,
            newMobSatiations[nearestTarget.idx] - damage,
          );
          if (newMobSatiations[nearestTarget.idx] <= 0) {
            stepMessage = `${initialMobs[nearestTarget.idx].name} has fallen unconscious!`;
          }
        }
        return adv;
      }

      // Move toward target
      occupied.delete(`${adv.x}_${adv.z}`);
      const pos = greedyStepToward(
        adv.x,
        adv.z,
        nearestTarget.x,
        nearestTarget.z,
        isWalkable,
        (x, z) => occupied.has(`${x}_${z}`),
      );
      if (pos) {
        occupied.add(`${pos.x}_${pos.z}`);
        return { ...adv, x: pos.x, z: pos.z };
      }
      occupied.add(`${adv.x}_${adv.z}`);
      return adv;
    });

    // --- Conscious mob counterattack ---
    for (let i = 0; i < initialMobs.length; i++) {
      if (newMobSatiations[i] <= 0) continue; // unconscious
      const mob = initialMobs[i];
      for (let j = 0; j < newAdventurers.length; j++) {
        const adv = newAdventurers[j];
        if (!adv.alive) continue;
        if (Math.abs(adv.x - mob.x) + Math.abs(adv.z - mob.z) === 1) {
          const damage = Math.max(1, mob.attack - adv.defense);
          const newHp = adv.hp - damage;
          if (newHp <= 0) {
            newAdventurers[j] = { ...adv, alive: false, hp: 0 };
            newXpDrops.push({
              id: `xp_${Date.now()}_${j}`,
              x: adv.x,
              z: adv.z,
              amount: adv.xp,
            });
            stepMessage = `${mob.name} slew the ${adv.name}! (+${adv.xp} XP dropped)`;
          } else {
            newAdventurers[j] = { ...adv, hp: newHp };
          }
          break; // each mob attacks at most one adventurer per step
        }
      }
    }

    // --- Commit all ref + state updates ---
    adventurersRef.current = newAdventurers;
    currentWaveRef.current = newWave;
    playerXpRef.current = newPlayerXp;
    xpDropsRef.current = newXpDrops;
    playerHpRef.current = newPlayerHp;
    mobSatiationsRef.current = newMobSatiations;

    setTurnCount(newTurnCount);
    setCurrentWave(newWave);
    setAdventurers([...newAdventurers]);
    setPlayerXp(newPlayerXp);
    setXpDrops([...newXpDrops]);
    setPlayerHp(newPlayerHp);
    setMobSatiations(newMobSatiations);

    if (stepMessage) showMsg(stepMessage);
  }, [
    tempDropPerStep,
    satiationDropPerStep,
    solidData,
    initialMobs,
    showMsg,
    spawnAdventurersForWave,
  ]);

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
    dungeonWidth,
    dungeonHeight,
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
    const isUnconscious = mobSatiations[facingTarget.mobIdx] <= 0;
    if (isUnconscious) {
      return `${mob?.name} is unconscious — Press I to offer tea to revive`;
    }
    return `${mob?.name} [prefers ${preferredRecipe?.name ?? "?"}] — Press I to offer tea`;
  }, [facingTarget, stoveStates, initialMobs, mobSatiations]);

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
        const isUnconscious = mobSatiations[facingTarget.mobIdx] <= 0;
        if (tea && !isUnconscious && mobStatus === "ecstatic") {
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

        function applyMobSatiation(value) {
          const next = [...mobSatiationsRef.current];
          next[facingTarget.mobIdx] = value;
          mobSatiationsRef.current = next;
          setMobSatiations(next);
        }

        if (tea.ruined || tea.temperature < lo) {
          applyMobSatiation(10);
          showMsg(
            `${mob.name} says: "This ${tea.name} is cold and ruined... How disappointing."`,
          );
        } else if (tea.temperature > hi) {
          applyMobSatiation(30);
          showMsg(
            `${mob.name} says: "Ouch! This ${tea.name} is scalding hot! Dreadfully disappointing."`,
          );
        } else {
          const isPreferred = mob.preferredRecipeId === tea.recipe.id;
          const baseSatiation = 100;
          const bonus = isPreferred
            ? baseSatiation * (supersatiationBonus / 100)
            : 0;
          applyMobSatiation(baseSatiation + bonus);
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
    mobSatiations,
    activeStoveKey,
    showMsg,
    onStep,
    supersatiationBonus,
  ]);

  // Minimap
  const minimapRef = useRef(null);
  const [minimapTooltip, setMinimapTooltip] = useState(null);
  const minimapMobs = useMemo(
    () => [
      ...initialMobs.map((m, i) => ({
        x: m.x,
        z: m.z,
        name: m.name,
        status: mobSatiations[i] <= 0 ? "unconscious" : mobStatuses[i],
        satiation: mobSatiations[i],
        cssColor:
          mobSatiations[i] <= 0
            ? "#555"
            : (STATUS_CSS[mobStatuses[i]] ?? STATUS_CSS.thirsty),
        isAdventurer: false,
        isXp: false,
      })),
      ...adventurers
        .filter((a) => a.alive)
        .map((a) => ({
          x: a.x,
          z: a.z,
          name: a.name,
          hp: a.hp,
          maxHp: a.maxHp,
          cssColor:
            a.template === "warrior"
              ? "#e44"
              : a.template === "rogue"
                ? "#e4e"
                : "#44e",
          isAdventurer: true,
          isXp: false,
        })),
      ...xpDrops.map((drop) => ({
        x: drop.x,
        z: drop.z,
        name: `+${drop.amount} XP`,
        amount: drop.amount,
        cssColor: "#fd0",
        isAdventurer: false,
        isXp: true,
      })),
    ],
    [initialMobs, mobStatuses, mobSatiations, adventurers, xpDrops],
  );

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
    [minimapMobs],
  );
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
          <span
            style={{ color: currentWave > 0 ? "#f88" : "#555", fontSize: 12 }}
          >
            Wave {currentWave}
          </span>
        </div>

        {/* Main area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 3D view */}
          <div style={{ flex: 1, position: "relative" }}>
            {texture && (
              <PerspectiveDungeonView
                solidData={solidData}
                width={dungeonWidth}
                height={dungeonHeight}
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

            {/* Wave countdown overlay */}
            {(() => {
              const turnsLeft = turnsPerWave - (turnCount % turnsPerWave);
              const show =
                turnsLeft <= WAVE_COUNTDOWN_THRESHOLD &&
                adventurers.filter((a) => a.alive).length === 0;
              if (!show) return null;
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
            })()}

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
                    style={{
                      fontWeight: "bold",
                      color: minimapTooltip.mob.cssColor,
                    }}
                  >
                    {minimapTooltip.mob.name}
                  </div>
                  {minimapTooltip.mob.isXp ? (
                    <div style={{ color: "#fd0" }}>Walk here to collect</div>
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
            <SettingsTabs
              tempDropPerStep={tempDropPerStep}
              setTempDropPerStep={setTempDropPerStep}
              satiationDropPerStep={satiationDropPerStep}
              turnsPerWave={turnsPerWave}
              setTurnsPerWave={setTurnsPerWave}
              setSatiationDropPerStep={setSatiationDropPerStep}
              supersatiationBonus={supersatiationBonus}
              setSupersatiationBonus={setSupersatiationBonus}
              dungeonSeed={dungeonSeed}
              setDungeonSeed={setDungeonSeed}
              dungeonWidth={dungeonWidth}
              setDungeonWidth={setDungeonWidth}
              dungeonHeight={dungeonHeight}
              setDungeonHeight={setDungeonHeight}
              minLeafSize={minLeafSize}
              setMinLeafSize={setMinLeafSize}
              maxLeafSize={maxLeafSize}
              setMaxLeafSize={setMaxLeafSize}
              minRoomSize={minRoomSize}
              setMinRoomSize={setMinRoomSize}
              maxRoomSize={maxRoomSize}
              setMaxRoomSize={setMaxRoomSize}
            />
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
          <span
            style={{
              color: playerHp <= 5 ? "#f44" : playerHp <= 15 ? "#fa0" : "#4f4",
            }}
          >
            HP: {playerHp}/{PLAYER_MAX_HP}
          </span>
          <span style={{ color: "#fa0" }}>XP: {playerXp}</span>
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
