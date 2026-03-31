import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { aStar8 } from "../roguelike-mazetools/src/astar";
import * as THREE from "three";
import { generateBspDungeon } from "../roguelike-mazetools/src/bsp";
import {
  generateHiddenPassages,
  generateThemedRooms,
  makeContentRng,
} from "../roguelike-mazetools/src/content";
import { buildAtlasIndex } from "../roguelike-mazetools/src/atlas";
import atlasJson from "./assets/atlas.json";
import {
  buildTileAtlas,
  uvToTileId,
} from "../roguelike-mazetools/src/rendering/tileAtlas";
import {
  TORCH_OBJECT_VERT,
  TORCH_OBJECT_FRAG,
  makeTorchUniforms,
  DEFAULT_TORCH_HEX,
  DEFAULT_TORCH_INTENSITY,
} from "../roguelike-mazetools/src/rendering/torchLighting";
import { PerspectiveDungeonView } from "../roguelike-mazetools/src/rendering/PerspectiveDungeonView";
import {
  buildPassageMask,
  enablePassageInMask,
  disablePassageInMask,
} from "../roguelike-mazetools/src/rendering/hiddenPassagesMask";
import {
  startPassageTraversal,
  consumePassageStep,
  cancelPassageTraversal,
} from "../roguelike-mazetools/src/turn/passageTraversal";
import { RECIPES } from "./tea";
import { THEMES, THEME_KEYS } from "./themes";
import { useMusic } from "./hooks/useMusic";
import { useMessage } from "./hooks/useMessage";
import { useMinimapData } from "./hooks/useMinimapData";
import { useSettings } from "./SettingsContext";
import hotkeys from "hotkeys-js";
import { GameHeader } from "./components/GameHeader";
import { StatusBar } from "./components/StatusBar";
import { HandsHUD } from "./components/HandsHUD";
import { WaveCountdown } from "./components/WaveCountdown";
import { RecipeMenu } from "./components/RecipeMenu";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { MinimapSidebar } from "./components/MinimapSidebar";
import { DifficultyModal } from "./components/DifficultyModal";

import "./App.css";

console.log("[App module] top-level eval start");
const atlasIndex = buildAtlasIndex(atlasJson);
console.log("[App module] atlasIndex built");

// ---------------------------------------------------------------------------
// Tile atlas
// ---------------------------------------------------------------------------
const TILE_PX = 64;
const ATLAS_SHEET_W = 512;
const ATLAS_SHEET_H = 1024;
const TILE_SIZE = 3;
const CEILING_H = 3;

// Character sprite sheet dimensions (public/textures/characters.png)
const CHAR_SHEET_W = 512;
const CHAR_SHEET_H = 512;

/**
 * Convert a pixel-space UV rect {x, y, w, h} into the normalized [x, y, w, h]
 * tuple expected by the billboard shader (y=0 is bottom in GL convention).
 */
function normalizeUvRect(rect, sheetW, sheetH) {
  if (!rect) return undefined;
  return [
    rect.x / sheetW,
    1.0 - (rect.y + rect.h) / sheetH,
    rect.w / sheetW,
    rect.h / sheetH,
  ];
}

// Default tile IDs derived from atlas.json entries (row-major in 512×1024 sheet)
function _atlasUvToId(uv) {
  return uvToTileId(uv[0], uv[1], TILE_PX, ATLAS_SHEET_W);
}
const _defaultFloorEntry = atlasIndex.floorTypes.byName("Cobblestone");
const _defaultWallEntry = atlasIndex.wallTypes.byName("Cobblestone");
const _defaultCeilingEntry = atlasIndex.ceilingTypes.byName("Cobblestone");
const TILE_FLOOR =
  _defaultFloorEntry && "uv" in _defaultFloorEntry
    ? _atlasUvToId(_defaultFloorEntry.uv)
    : 0;
const TILE_CEILING =
  _defaultCeilingEntry && "uv" in _defaultCeilingEntry
    ? _atlasUvToId(_defaultCeilingEntry.uv)
    : TILE_FLOOR;
const TILE_WALL =
  _defaultWallEntry && "uv" in _defaultWallEntry
    ? _atlasUvToId(_defaultWallEntry.uv)
    : 0;

// Build maps: atlas type ID (1-based) → row-major tile ID in the full atlas sheet
const FLOOR_TILE_MAP = atlasIndex.data.floorTypes.map((ft) =>
  "uv" in ft ? _atlasUvToId(ft.uv) : TILE_FLOOR,
);
const WALL_TILE_MAP = atlasIndex.data.wallTypes.map((wt) =>
  "uv" in wt ? _atlasUvToId(wt.uv) : TILE_WALL,
);
const CEILING_TILE_MAP = atlasIndex.data.ceilingTypes.map((ct) =>
  "uv" in ct ? _atlasUvToId(ct.uv) : TILE_CEILING,
);
const ARCH_COBBLE_UV = atlasIndex.architecture.byName("archCobble")?.uv ?? [
  64, 0,
];
const ARCH_BRICK_UV = atlasIndex.architecture.byName("archBrick")?.uv ?? [
  0, 64,
];
const COBBLESTONE_WALL_ID = atlasIndex.wallTypes.idByName("Cobblestone");
const PASSAGE_OVERLAY_IDS = [
  _atlasUvToId(atlasIndex.wallOverlays.byName("buttonUnpressed")?.uv ?? [256, 256]),
  _atlasUvToId(atlasIndex.wallOverlays.byName("buttonPressed")?.uv ?? [192, 256]),
  _atlasUvToId(atlasIndex.wallOverlays.byName("openEmptyDoorDark")?.uv ?? [192, 0]),
];

function loadAtlasTexture() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = reject;
    img.src = `${import.meta.env.BASE_URL}textures/atlas.png`;
  });
}

// ---------------------------------------------------------------------------
// Door 3-D object — thin slab spanning full cell width and ceiling height
// ---------------------------------------------------------------------------

function makeDoorProto(atlasTex, archUvX, archUvY) {
  const geo = new THREE.PlaneGeometry(TILE_SIZE * 0.9, CEILING_H * 0.98);
  const uMin = archUvX / ATLAS_SHEET_W;
  const uMax = (archUvX + TILE_PX) / ATLAS_SHEET_W;
  const vMin = 1 - (archUvY + TILE_PX) / ATLAS_SHEET_H;
  const vMax = 1 - archUvY / ATLAS_SHEET_H;
  // PlaneGeometry vertex order: TL, TR, BL, BR
  geo.setAttribute(
    "uv",
    new THREE.BufferAttribute(
      new Float32Array([uMin, vMax, uMax, vMax, uMin, vMin, uMax, vMin]),
      2,
    ),
  );
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: atlasTex },
      uFogColor: { value: new THREE.Color(0, 0, 0) },
      uFogNear: { value: 4 },
      uFogFar: { value: 28 },
      uTime: { value: 0 },
      ...makeTorchUniforms(),
    },
    vertexShader: TORCH_OBJECT_VERT,
    fragmentShader: TORCH_OBJECT_FRAG,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------------------
// Teaomatic machine — atlas-textured BoxGeometry proto
// ---------------------------------------------------------------------------
function makeTeaomaticProto(atlasTex) {
  const uvEntry = atlasIndex.sprites.byName("teaomatic");
  const [uvX, uvY] = uvEntry.uv;
  const [uvW, uvH] = uvEntry.size ?? [TILE_PX, TILE_PX];
  const uMin = uvX / ATLAS_SHEET_W;
  const uMax = (uvX + uvW) / ATLAS_SHEET_W;
  const vMin = 1 - (uvY + uvH) / ATLAS_SHEET_H;
  const vMax = 1 - uvY / ATLAS_SHEET_H;

  const bW = TILE_SIZE * 0.65;
  const bH = CEILING_H * 0.85;
  const bD = TILE_SIZE * 0.65;
  const geo = new THREE.BoxGeometry(bW, bH, bD);

  // BoxGeometry vertex UV order per face: TL, TR, BL, BR
  const faceUv = [uMin, vMax, uMax, vMax, uMin, vMin, uMax, vMin];
  const uvArr = new Float32Array(6 * 8);
  for (let i = 0; i < 6; i++) uvArr.set(faceUv, i * 8);
  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: atlasTex },
      uFogColor: { value: new THREE.Color(0, 0, 0) },
      uFogNear: { value: 4 },
      uFogFar: { value: 28 },
      uTime: { value: 0 },
      ...makeTorchUniforms(),
    },
    vertexShader: TORCH_OBJECT_VERT,
    fragmentShader: TORCH_OBJECT_FRAG,
    side: THREE.FrontSide,
  });

  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------------------
// Explored mask helpers
// ---------------------------------------------------------------------------
const LOS_RADIUS = 8;

/**
 * Builds the initial explored mask for a new dungeon.
 * Pre-explores the kitchen (startRoomId), the first monster's room, and the
 * corridor path connecting them.
 */
function buildInitialExploredMask(dungeon, width, height) {
  const mask = new Uint8Array(width * height);
  const { rooms, endRoomId, fullRegionIds } = dungeon;

  function markRegion(regionId) {
    for (let i = 0; i < fullRegionIds.length; i++) {
      if (fullRegionIds[i] === regionId) mask[i] = 1;
    }
  }

  // Kitchen = endRoomId
  markRegion(endRoomId);

  // First monster room = first room (not endRoomId) in insertion order
  let firstMobRoomId = null;
  for (const [roomId, room] of rooms) {
    if (roomId !== endRoomId && room.type === "room") {
      firstMobRoomId = roomId;
      break;
    }
  }

  if (firstMobRoomId !== null) {
    markRegion(firstMobRoomId);

    // Map each room ID to the corridor IDs that border it
    const roomToCorridors = new Map();
    for (const [id, room] of rooms) {
      if (room.type !== "corridor") continue;
      for (const connRoomId of room.connections) {
        if (!roomToCorridors.has(connRoomId))
          roomToCorridors.set(connRoomId, []);
        roomToCorridors.get(connRoomId).push(id);
      }
    }

    // BFS from endRoomId to firstMobRoomId; mark corridors on path
    const visited = new Set([endRoomId]);
    const queue = [[endRoomId, []]]; // [roomId, corridorPath]

    outer: while (queue.length > 0) {
      const [curRoom, corridorPath] = queue.shift();
      for (const corridorId of roomToCorridors.get(curRoom) ?? []) {
        const corridor = rooms.get(corridorId);
        if (!corridor) continue;
        for (const nextRoom of corridor.connections) {
          if (nextRoom === curRoom || visited.has(nextRoom)) continue;
          visited.add(nextRoom);
          const newPath = [...corridorPath, corridorId];
          if (nextRoom === firstMobRoomId) {
            for (const cid of newPath) markRegion(cid);
            break outer;
          }
          queue.push([nextRoom, newPath]);
        }
      }
    }
  }

  return mask;
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

// Bresenham line-of-sight: returns true if ax,az can see bx,bz with no walls in between.
// Checks all intermediate cells (not endpoints) for walkability.
function hasLineOfSight(ax, az, bx, bz, walkableFn) {
  let x0 = ax,
    z0 = az;
  const x1 = bx,
    z1 = bz;
  const dx = Math.abs(x1 - x0),
    dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1,
    sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  while (true) {
    if (x0 === x1 && z0 === z1) return true;
    if (!walkableFn(x0, z0)) return false;
    const e2 = 2 * err;
    if (e2 > -dz) {
      err -= dz;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      z0 += sz;
    }
  }
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
  {
    onStep,
    blocked,
    onBlockedMove,
    canPhaseWalls,
    keybindings,
    startYaw = 0,
  } = {},
) {
  const logicalRef = useRef({ x: startX, z: startZ, yaw: startYaw });
  const animRef = useRef({
    fromX: startX,
    fromZ: startZ,
    fromYaw: startYaw,
    toX: startX,
    toZ: startZ,
    toYaw: startYaw,
    startTime: 0,
    animating: false,
  });
  const [camera, setCamera] = useState(() => ({
    x: startX,
    z: startZ,
    yaw: startYaw,
  }));
  const [prevStartX, setPrevStartX] = useState(startX);
  const [prevStartZ, setPrevStartZ] = useState(startZ);
  const solidRef = useRef(solidData);
  const onStepRef = useRef(onStep);
  const blockedRef = useRef(blocked);
  const onBlockedMoveRef = useRef(onBlockedMove);
  const canPhaseWallsRef = useRef(canPhaseWalls ?? false);

  if (prevStartX !== startX || prevStartZ !== startZ) {
    setPrevStartX(startX);
    setPrevStartZ(startZ);
    setCamera({ x: startX, z: startZ, yaw: startYaw });
  }

  useEffect(() => {
    logicalRef.current = { x: startX, z: startZ, yaw: startYaw };
    animRef.current = {
      fromX: startX,
      fromZ: startZ,
      fromYaw: startYaw,
      toX: startX,
      toZ: startZ,
      toYaw: startYaw,
      startTime: 0,
      animating: false,
    };
  }, [startX, startZ]);

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
    onBlockedMoveRef.current = onBlockedMove;
  }, [onBlockedMove]);
  useEffect(() => {
    canPhaseWallsRef.current = canPhaseWalls ?? false;
  }, [canPhaseWalls]);

  useEffect(() => {
    function walkable(cx, cz) {
      if (cx < 0 || cz < 0 || cx >= width || cz >= height) return false;
      if (canPhaseWallsRef.current) return true; // ghost phases through walls with empty hands
      if (!solidRef.current) return false;
      return solidRef.current[cz * width + cx] === 0;
    }

    function beginAnim(toX, toZ, toYaw, isMove) {
      const { x: fx, z: fz, yaw: fyaw } = logicalRef.current;
      animRef.current = {
        fromX: fx,
        fromZ: fz,
        fromYaw: fyaw,
        toX,
        toZ,
        toYaw,
        startTime: performance.now(),
        animating: true,
      };
      logicalRef.current = { x: toX, z: toZ, yaw: toYaw };
      if (isMove) onStepRef.current?.();
    }

    function guard() {
      return blockedRef.current || animRef.current.animating;
    }

    const moveForwardHandler = (e) => {
      if (guard()) return;
      e.preventDefault();
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)),
        fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x),
        gz = Math.floor(z);
      const ngx = gx + fdx,
        ngz = gz + fdz;
      if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw, true);
      else onBlockedMoveRef.current?.(fdx, fdz);
    };
    const moveBackwardHandler = (e) => {
      if (guard()) return;
      e.preventDefault();
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)),
        fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x),
        gz = Math.floor(z);
      const ngx = gx - fdx,
        ngz = gz - fdz;
      if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw, true);
      else onBlockedMoveRef.current?.(-fdx, -fdz);
    };
    const strafeLeftHandler = (e) => {
      if (guard()) return;
      e.preventDefault();
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)),
        fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x),
        gz = Math.floor(z);
      const sgx = gx + fdz,
        sgz = gz - fdx;
      if (walkable(sgx, sgz)) beginAnim(sgx + 0.5, sgz + 0.5, yaw, true);
    };
    const strafeRightHandler = (e) => {
      if (guard()) return;
      e.preventDefault();
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)),
        fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x),
        gz = Math.floor(z);
      const sgx = gx - fdz,
        sgz = gz + fdx;
      if (walkable(sgx, sgz)) beginAnim(sgx + 0.5, sgz + 0.5, yaw, true);
    };
    const turnLeftHandler = (e) => {
      if (guard()) return;
      e.preventDefault();
      const { x, z, yaw } = logicalRef.current;
      beginAnim(x, z, yaw + Math.PI / 2, false);
    };
    const turnRightHandler = (e) => {
      if (guard()) return;
      e.preventDefault();
      const { x, z, yaw } = logicalRef.current;
      beginAnim(x, z, yaw - Math.PI / 2, false);
    };

    const bindings = [
      [keybindings.moveForward, moveForwardHandler],
      [keybindings.moveBackward, moveBackwardHandler],
      [keybindings.strafeLeft, strafeLeftHandler],
      [keybindings.strafeRight, strafeRightHandler],
      [keybindings.turnLeft, turnLeftHandler],
      [keybindings.turnRight, turnRightHandler],
    ];
    for (const [keys, handler] of bindings) {
      if (keys.length) hotkeys(keys.join(","), handler);
    }
    return () => {
      for (const [keys, handler] of bindings) {
        if (keys.length) hotkeys.unbind(keys.join(","), handler);
      }
    };
  }, [width, height, keybindings]);

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

  function doMove(dx, dz) {
    const { x, z, yaw } = logicalRef.current;
    const toX = x + dx;
    const toZ = z + dz;
    animRef.current = {
      fromX: x,
      fromZ: z,
      fromYaw: yaw,
      toX,
      toZ,
      toYaw: yaw,
      startTime: performance.now(),
      animating: true,
    };
    logicalRef.current = { x: toX, z: toZ, yaw };
    onStepRef.current?.();
  }

  return { camera, logicalRef, doMove };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DUNGEON_SEED = 42;
const DUNGEON_W = 32;
const DUNGEON_H = DUNGEON_W;
const MOB_TYPES = [
  {
    type: "bat",
    name: "Bat",
    geometrySize: [2, 1],
    uvRect: { x: 0, y: 448, w: 128, h: 64 },
  },
];
const MOB_TYPE_MAP = Object.fromEntries(MOB_TYPES.map((t) => [t.type, t]));
const MOB_NAMES = MOB_TYPES.map((t) => t.name);

// Dialog pools for when an adventurer first spots the ghost (player)
const GHOST_DIALOG = [
  "A ghost! Good heavens — I wasn't expecting that.",
  "Is that... a ghost?! By all the teapots in the realm!",
  "Oh! Oh my. There's definitely a ghost right there.",
  "W-wait. Is that a spectre? This dungeon is stranger than I thought.",
  "A ghost! I must be losing my mind... or the dungeon is haunted. Probably both.",
  "There's definitely a ghost in here. I'm choosing to remain calm about this.",
  "Hm. A ghost. Not what I planned for today, but here we are.",
  "So there's a ghost. Fine. I've seen stranger things in a dungeon.",
  "A ghost. Well... at least it's not another adventurer.",
  "I wonder if ghosts prefer tea. I should ask, if it doesn't kill me first.",
];
const GHOST_DIALOG_WITH_TEA = [
  "A ghost! And — wait, why is my cup floating?! Oh. Oh no.",
  "Is that a ghost?! And it's... it appears to be drifting alongside my tea. Fascinating. Terrifying.",
  "A ghost! Good heavens — now there's a disembodied cup tumbling through the air alongside it.",
  "W-what?! A ghost AND a levitating cup of tea? This dungeon has gone completely mad.",
  "A ghost! By the kettle — my tea appears to be floating of its own accord now.",
  "There's a ghost, and my cup appears to be floating. I'm going to carry on.",
  "A ghost nearby... and a disembodied cup of tea hovering in the air. Perfectly normal dungeon.",
  "The ghost seems interested in the tea. Or maybe the cup is just haunted now. Hard to say.",
  "I suppose a floating cup of tea is less alarming than a ghost. Only slightly.",
  "My tea is levitating. There's a ghost. I am fine. Everything is fine.",
];
const ADVENTURER_SEEKING_DIALOG = [
  "Enough plunder — now to find the heart of this place!",
  "Right, that'll do. Time to hunt down whatever keeps this pit warm.",
  "My pockets are full and my nerves are shot. The stove must be near!",
  "Loot? Check. Creeping dread? Absolutely. Let's finish this.",
  "Something cosy lurks deeper in. I can smell the tea from here.",
  "That's enough loot. Now — where is that infernal warmth coming from?",
];

const GHOST_SIGHT_RADIUS = 8;

const TURNS_PER_WAVE = 120;
const WAVE_COUNTDOWN_THRESHOLD = 20;
const PLAYER_MAX_HP = 30;
const PLAYER_DEFENSE = 2;
const MOB_ATTACK = 3;
const MOB_DEFENSE = 1;
const WIN_WAVES = 10;

// ingredientId matches RECIPES ingredientId
const ADVENTURER_TYPES = [
  {
    type: "warrior",
    name: "Warrior",
    hp: 20,
    attack: 5,
    defense: 2,
    xp: 30,
    colorRgb: [1.0, 0.15, 0.15],
    drop: { id: "rations", name: "Iron Rations" },
    geometrySize: [1, 1],
    uvRect: { x: 192, y: 0, w: 64, h: 64 },
  },
  {
    type: "rogue",
    name: "Rogue",
    hp: 12,
    attack: 7,
    defense: 1,
    xp: 25,
    colorRgb: [0.9, 0.1, 0.9],
    drop: { id: "herbs", name: "Wild Herbs" },
    geometrySize: [1, 1],
    uvRect: { x: 192, y: 0, w: 64, h: 64 },
  },
  {
    type: "mage",
    name: "Mage",
    hp: 10,
    attack: 9,
    defense: 0,
    xp: 40,
    colorRgb: [0.2, 0.3, 1.0],
    drop: { id: "dust", name: "Arcane Dust" },
    geometrySize: [2, 2],
    uvRect: { x: 192, y: 128, w: 128, h: 128 },
  },
];

/** Keyed by adventurer type string for O(1) lookup in the mobiles memo. */
const ADVENTURER_TYPE_MAP = Object.fromEntries(
  ADVENTURER_TYPES.map((t) => [t.type, t]),
);

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
// Seeded LCG RNG (Numerical Recipes constants)
// ---------------------------------------------------------------------------
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

console.log("[App module] all top-level defs done");
// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const {
    dungeonSeed,
    setDungeonSeed,
    dungeonWidth,
    setDungeonWidth,
    dungeonHeight,
    setDungeonHeight,
    minLeafSize,
    setMinLeafSize,
    maxLeafSize,
    setMaxLeafSize,
    minRoomSize,
    setMinRoomSize,
    maxRoomSize,
    setMaxRoomSize,
    maxDoors,
    setMaxDoors,
    tempDropPerStep,
    setTempDropPerStep,
    heatingPerStep,
    setHeatingPerStep,
    satiationDropPerStep,
    setSatiationDropPerStep,
    supersatiationBonus,
    setSupersatiationBonus,
    turnsPerWave,
    setTurnsPerWave,
    traversalFactor,
    setTraversalFactor,
    adventurerDreadRate,
    setAdventurerDreadRate,
    adventurerLootPerChest,
    setAdventurerLootPerChest,
    torchColor,
    setTorchColor,
    torchIntensity,
    setTorchIntensity,
    keybindings,
    setKeybindings,
  } = useSettings();

  const dungeon = useMemo(() => {
    const d = generateBspDungeon({
      width: dungeonWidth,
      height: dungeonHeight,
      seed: dungeonSeed,
      minLeafSize,
      maxLeafSize,
      minRoomSize,
      maxRoomSize,
      corridorWidth: 2,
    });
    return d;
  }, [
    dungeonSeed,
    dungeonWidth,
    dungeonHeight,
    minLeafSize,
    maxLeafSize,
    minRoomSize,
    maxRoomSize,
  ]);

  const solidData = useMemo(() => dungeon.textures.solid.image.data, [dungeon]);
  const floorData = useMemo(
    () => dungeon.textures.floorType.image.data,
    [dungeon],
  );
  const wallData = useMemo(
    () => dungeon.textures.wallType.image.data,
    [dungeon],
  );
  const ceilingData = useMemo(
    () => dungeon.textures.ceilingType.image.data,
    [dungeon],
  );
  const temperatureData = useMemo(
    () => dungeon.textures.temperature.image.data,
    [dungeon],
  );
  const [showTempTint, setShowTempTint] = useState(false);

  const { spawnX, spawnZ, spawnYaw } = useMemo(() => {
    const room = dungeon.rooms.get(dungeon.endRoomId);
    if (!room) return { spawnX: 1.5, spawnZ: 1.5, spawnYaw: 0 };
    return {
      spawnX: room.rect.x + Math.floor(room.rect.w / 2) + 0.5,
      spawnZ: room.rect.y + Math.floor(room.rect.h / 2) + 1.5, // one cell south of stove
      spawnYaw: Math.PI, // face north toward the stove
    };
  }, [dungeon]);

  // Assign floor/wall/ceiling types to every room and corridor by theme
  useMemo(() => {
    const floorData = dungeon.textures.floorType.image.data;
    const wallData = dungeon.textures.wallType.image.data;
    const ceilingData = dungeon.textures.ceilingType.image.data;
    const solidData = dungeon.textures.solid.image.data;
    const rng = makeRng(dungeon.seed);
    const themes = {};
    for (const [roomId, room] of dungeon.rooms) {
      console.log("room", room);
      let floorId, wallId, ceilingId;
      if (roomId === dungeon.startRoomId) {
        floorId = atlasIndex.floorTypes.idByName("Steel");
        wallId = atlasIndex.wallTypes.idByName("Concrete");
        ceilingId = atlasIndex.ceilingTypes.idByName("Steel");
      } else if (roomId === dungeon.endRoomId) {
        floorId = atlasIndex.floorTypes.idByName("Flagstone");
        wallId = atlasIndex.wallTypes.idByName("Plaster");
        ceilingId = atlasIndex.ceilingTypes.idByName("Flagstone");
      }
      // else if (room.type === "corridor") {
      //   floorId = atlasIndex.floorTypes.idByName("Cobblestone");
      //   wallId = atlasIndex.wallTypes.idByName("Cobblestone");
      //   ceilingId = atlasIndex.ceilingTypes.idByName("Cobblestone");
      // }
      else {
        const key = THEME_KEYS[Math.floor(rng() * THEME_KEYS.length)];
        const theme = THEMES[key];
        floorId = atlasIndex.floorTypes.idByName(theme.floorType);
        wallId = atlasIndex.wallTypes.idByName(theme.wallType);
        ceilingId = atlasIndex.ceilingTypes.idByName(theme.ceilingType);
      }
      themes[roomId] = (x, y, ctx) => {
        const i = y * ctx.width + x;
        if (solidData[i] === 0) {
          floorData[i] = floorId;
          ceilingData[i] = ceilingId;
        } else {
          wallData[i] = wallId;
        }
      };
    }
    generateThemedRooms(dungeon, themes);
    dungeon.textures.floorType.needsUpdate = true;
    dungeon.textures.wallType.needsUpdate = true;
    dungeon.textures.ceilingType.needsUpdate = true;
  }, [dungeon]);

  // Stove placements via generateContent — 2 stoves in end room at distanceToWall === 1
  const stovePlacements = useMemo(() => {
    const room = dungeon.rooms.get(dungeon.endRoomId);
    if (!room) return [];
    const cx = room.rect.x + Math.floor(room.rect.w / 2);
    const cz = room.rect.y + Math.floor(room.rect.h / 2);
    return [{ x: cx, z: cz, type: "stove" }];
  }, [dungeon]);

  // Door placements — disabled pending rework
  const doorPlacements = useMemo(() => {
    const W = dungeon.width;
    const H = dungeon.height;
    const solidArr = dungeon.textures.solid.image.data;
    const regionArr = dungeon.textures.regionId.image.data;
    const wallDataArr = dungeon.textures.wallType.image.data;

    function isCorridor(x, z) {
      if (x < 0 || z < 0 || x >= W || z >= H) return false;
      return solidArr[z * W + x] === 0 && regionArr[z * W + x] === 0;
    }
    function isRoom(x, z) {
      if (x < 0 || z < 0 || x >= W || z >= H) return false;
      return solidArr[z * W + x] === 0 && regionArr[z * W + x] !== 0;
    }

    // Find all threshold cells: corridor cells directly adjacent to a room cell
    const groups = new Map();
    const DIRS4 = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        if (!isCorridor(x, z)) continue;
        for (const [dx, dz] of DIRS4) {
          if (isRoom(x + dx, z + dz)) {
            // Group key: direction + the fixed coordinate (row or column index)
            const key = `${dx}_${dz}_${dx === 0 ? z : x}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ x, z, dx, dz });
            break;
          }
        }
      }
    }

    // Collect all candidate door positions without mutating solidArr yet
    const candidates = [];
    for (const cells of groups.values()) {
      if (cells.length === 0) continue;
      const { dx, dz } = cells[0];
      cells.sort((a, b) => (dx === 0 ? a.x - b.x : a.z - b.z));
      const midIdx = Math.floor(cells.length / 2);
      const { x, z } = cells[midIdx];
      const doorYaw = dx === 0 ? 0 : Math.PI / 2;

      // Sample the adjacent room's wall type from a perpendicular solid cell.
      // Perpendicular to direction (dx, dz) is (-dz, dx).
      const rx = x + dx;
      const rz = z + dz;
      let roomWallId = 0;
      for (const [px, pz] of [
        [rx - dz, rz + dx],
        [rx + dz, rz - dx],
      ]) {
        if (px >= 0 && px < W && pz >= 0 && pz < H) {
          const pi = pz * W + px;
          if (solidArr[pi] !== 0 && wallDataArr[pi] !== 0) {
            roomWallId = wallDataArr[pi];
            break;
          }
        }
      }
      const archType = roomWallId === COBBLESTONE_WALL_ID ? "cobble" : "brick";

      candidates.push({
        cells,
        midIdx,
        roomWallId: roomWallId || COBBLESTONE_WALL_ID,
        placement: {
          x,
          z,
          type: `door_${archType}`,
          offsetX: 0,
          offsetZ: 0,
          offsetY: CEILING_H / 2,
          yaw: doorYaw,
          meta: { blockDx: dx, blockDz: dz },
        },
      });
    }

    // Sort deterministically by position, then cap at maxDoors
    candidates.sort(
      (a, b) => a.placement.z - b.placement.z || a.placement.x - b.placement.x,
    );
    const selected = new Set(candidates.slice(0, maxDoors).map((_, i) => i));

    const placements = [];
    candidates.forEach((c, i) => {
      if (selected.has(i)) {
        c.cells.forEach((cell, j) => {
          if (j !== c.midIdx) {
            // Wall off non-door threshold cells; use the room's wall type
            solidArr[cell.z * W + cell.x] = 255;
            wallDataArr[cell.z * W + cell.x] = c.roomWallId;
          }
        });
        placements.push(c.placement);
      }
      // else: leave corridor open with no door
    });

    dungeon.textures.solid.needsUpdate = true;
    dungeon.textures.wallType.needsUpdate = true;
    return placements;
  }, [dungeon, maxDoors]);

  // Object registry and world placements
  const objects = useMemo(() => {
    return [
      ...stovePlacements.map((s) => ({
        ...s,
        offsetY: (CEILING_H * 0.85) / 2,
      })),
      ...doorPlacements,
    ];
  }, [stovePlacements, doorPlacements]);

  // Passive mobs — one per non-end room (up to 3)
  const initialMobs = useMemo(() => {
    console.log(
      dungeon.rooms.size,
      "endRoomId:",
      dungeon.endRoomId,
      "MOB_NAMES:",
      MOB_NAMES,
    );
    const mobs = [];
    let idx = 0;
    for (const [roomId, room] of dungeon.rooms) {
      console.log(
        roomId,
        "type:",
        room.type,
        "isEnd:",
        roomId === dungeon.endRoomId,
        "idx:",
        idx,
      );
      if (roomId === dungeon.endRoomId || idx >= MOB_NAMES.length) continue;
      mobs.push({
        id: `mob_${idx}`,
        x: Math.floor(room.rect.x + room.rect.w / 2),
        z: Math.floor(room.rect.y + room.rect.h / 2),
        name: MOB_NAMES[idx],
        type: MOB_TYPES[idx].type,
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

  // Scatter ingredients across non-end rooms at game start
  const initialIngredientDrops = useMemo(() => {
    const rng = makeRng(dungeonSeed ^ 0x1337beef);
    const ingTypes = [
      { id: "rations", name: "Iron Rations" },
      { id: "herbs", name: "Wild Herbs" },
      { id: "dust", name: "Arcane Dust" },
    ];
    const nonEndRooms = Array.from(dungeon.rooms.entries())
      .filter(([id]) => id !== dungeon.endRoomId)
      .map(([, room]) => room);
    if (!nonEndRooms.length) return [];

    const drops = [];
    // 2 of each ingredient type = 6 items total
    for (let i = 0; i < 6; i++) {
      const ingType = ingTypes[i % ingTypes.length];
      const room = nonEndRooms[Math.floor(rng() * nonEndRooms.length)];
      const x =
        room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
      const z =
        room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
      drops.push({
        id: ingType.id,
        name: ingType.name,
        x,
        z,
        dropKey: `scatter_${i}`,
      });
    }
    return drops;
  }, [dungeon, dungeonSeed]);

  const initialChests = useMemo(() => {
    const rng = makeRng(dungeonSeed ^ 0x2aabcdef);
    const nonEndRooms = [...dungeon.rooms.values()].filter(
      (r) => r.id !== dungeon.endRoomId,
    );
    const chests = [];
    const usedRooms = new Set();
    const CHEST_COUNT = 4;
    for (
      let i = 0;
      i < CHEST_COUNT && nonEndRooms.length > usedRooms.size;
      i++
    ) {
      let attempts = 0;
      while (attempts++ < 50) {
        const roomIdx = Math.floor(rng() * nonEndRooms.length);
        const room = nonEndRooms[roomIdx];
        if (usedRooms.has(room.id)) continue;
        usedRooms.add(room.id);
        const cx = room.rect.x + Math.floor(room.rect.w / 2);
        const cz = room.rect.y + Math.floor(room.rect.h / 2);
        const idx = cz * dungeonWidth + cx;
        if (solidData[idx] !== 0) continue;
        chests.push({ id: `chest_${i}`, x: cx, z: cz, value: 10 });
        break;
      }
    }
    return chests;
  }, [dungeon, solidData, dungeonSeed, dungeonWidth]);

  // Tile atlas + texture
  const atlas = useMemo(
    () => buildTileAtlas(ATLAS_SHEET_W, ATLAS_SHEET_H, TILE_PX, TILE_PX),
    [],
  );
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    loadAtlasTexture().then((t) => {
      setTexture(t);
    });
  }, []);
  const [characterSpriteAtlas, setCharacterSpriteAtlas] = useState(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      setCharacterSpriteAtlas({ texture: tex, columns: 1, rows: 1 });
    };
    img.src = `${import.meta.env.BASE_URL}textures/monsters.png`;
  }, []);

  const teaomaticProto = useMemo(
    () => texture && makeTeaomaticProto(texture),
    [texture],
  );
  const doorCobbleProto = useMemo(
    () =>
      texture && makeDoorProto(texture, ARCH_COBBLE_UV[0], ARCH_COBBLE_UV[1]),
    [texture],
  );
  const doorBrickProto = useMemo(
    () => texture && makeDoorProto(texture, ARCH_BRICK_UV[0], ARCH_BRICK_UV[1]),
    [texture],
  );
  const objectRegistry = useMemo(
    () => ({
      ...(teaomaticProto && { stove: () => teaomaticProto.clone(true) }),
      ...(doorCobbleProto && {
        door_cobble: () => doorCobbleProto.clone(true),
      }),
      ...(doorBrickProto && { door_brick: () => doorBrickProto.clone(true) }),
    }),
    [teaomaticProto, doorCobbleProto, doorBrickProto],
  );

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const startingGreenTea = {
    id: crypto.randomUUID(),
    name: "Green Tea",
    recipe: RECIPES[0],
    temperature: 90,
    ruined: false,
  };
  const [playerHands, setPlayerHands] = useState({
    left: startingGreenTea,
    right: null,
  });
  const [mobSatiations, setMobSatiations] = useState(() =>
    initialMobs.map(() => 40),
  );
  const [mobPositions, setMobPositions] = useState(() =>
    initialMobs.map((m) => ({ x: m.x, z: m.z })),
  );
  const mobPositionsRef = useRef(mobPositions);
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
  const [recipeMenuCursor, setRecipeMenuCursor] = useState(0);
  const [activeStoveKey, setActiveStoveKey] = useState(null);
  const { message, setMessage, showMsg } = useMessage();
  const ruinedNotifiedRef = useRef(new Set());

  // ---------------------------------------------------------------------------
  // Speech bubbles — keyed by entity id; position looked up from live state
  // ---------------------------------------------------------------------------
  const [speechBubbles, setSpeechBubbles] = useState({}); // { [entityId]: { text } }
  const speechBubbleTimersRef = useRef({});

  const showSpeechBubble = useCallback((entityId, text, duration = 6000) => {
    setSpeechBubbles((prev) => ({ ...prev, [entityId]: { text } }));
    if (speechBubbleTimersRef.current[entityId]) {
      clearTimeout(speechBubbleTimersRef.current[entityId]);
    }
    speechBubbleTimersRef.current[entityId] = setTimeout(() => {
      setSpeechBubbles((prev) => {
        const next = { ...prev };
        delete next[entityId];
        return next;
      });
      delete speechBubbleTimersRef.current[entityId];
    }, duration);
  }, []);
  // Map<regionId, cumulativeRise> — only regions containing cozy objects heat up
  const [roomTempRise, setRoomTempRise] = useState(() => new Map());
  const regionIdData = useMemo(() => dungeon.fullRegionIds, [dungeon]);

  // Precompute unique adjacent region pairs for temperature flow.
  // Scan every cell and check right/down neighbors; a pair is added only once (a < b).
  // Pairs where a door sits at the threshold are excluded — doors block temperature flow.
  const regionAdjacency = useMemo(() => {
    // Build set of cell boundaries blocked by doors.
    // A door at (door.x, door.z) separates that cell from the adjacent room cell
    // in the direction stored in meta.blockDx / meta.blockDz.
    const blockedBoundaries = new Set();
    for (const door of doorPlacements) {
      const dx = door.meta?.blockDx ?? 0;
      const dz = door.meta?.blockDz ?? 0;
      const x1 = door.x,
        z1 = door.z;
      const x2 = door.x + dx,
        z2 = door.z + dz;
      // Canonical key: lower cell first (by z, then x)
      if (z1 < z2 || (z1 === z2 && x1 < x2)) {
        blockedBoundaries.add(`${x1},${z1},${x2},${z2}`);
      } else {
        blockedBoundaries.add(`${x2},${z2},${x1},${z1}`);
      }
    }

    const pairs = new Set();
    const W = dungeonWidth;
    const H = dungeonHeight;
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        if (solidData[i] !== 0) continue;
        const a = regionIdData[i];
        // right neighbor
        if (x + 1 < W && solidData[i + 1] === 0) {
          const b = regionIdData[i + 1];
          if (a !== b && !blockedBoundaries.has(`${x},${z},${x + 1},${z}`)) {
            pairs.add(a < b ? `${a},${b}` : `${b},${a}`);
          }
        }
        // down neighbor
        if (z + 1 < H && solidData[i + W] === 0) {
          const b = regionIdData[i + W];
          if (a !== b && !blockedBoundaries.has(`${x},${z},${x},${z + 1}`)) {
            pairs.add(a < b ? `${a},${b}` : `${b},${a}`);
          }
        }
      }
    }
    const result = Array.from(pairs).map((s) => s.split(",").map(Number));
    return result;
  }, [
    // dungeon,
    solidData,
    regionIdData,
    dungeonWidth,
    dungeonHeight,
    doorPlacements,
  ]);
  const dynamicTempData = useMemo(() => {
    const out = new Uint8Array(temperatureData.length);
    for (let i = 0; i < temperatureData.length; i++) {
      if (solidData[i] !== 0) continue;
      const regionId = regionIdData[i];
      const rise = Math.round(roomTempRise.get(regionId) ?? 0);
      out[i] = Math.min(255, temperatureData[i] + rise);
    }
    return out;
  }, [temperatureData, solidData, regionIdData, roomTempRise]);
  const [showSettings, setShowSettings] = useState(false);

  // Chests state
  const [chests, setChests] = useState([]);
  const chestsRef = useRef([]);

  // Wave / combat state
  const [adventurers, setAdventurers] = useState([]);
  const [currentWave, setCurrentWave] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [waveCountdown, setWaveCountdown] = useState(TURNS_PER_WAVE);
  const [playerXp, setPlayerXp] = useState(0);
  const [xpDrops, setXpDrops] = useState([]);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);

  // Ingredient inventory  { rations: 0, herbs: 0, dust: 0 }
  const [ingredients, setIngredients] = useState({
    rations: 0,
    herbs: 0,
    dust: 0,
  });
  const [ingredientDrops, setIngredientDrops] = useState([]);

  // Game-flow state
  const [gameState, setGameState] = useState("playing"); // "playing" | "gameover" | "won"
  const [gameOverReason, setGameOverReason] = useState(null);

  // Refs for synchronous cross-state access during game step processing
  const adventurersRef = useRef([]);
  const currentWaveRef = useRef(0);
  const turnCountRef = useRef(0);
  const waveCountdownRef = useRef(TURNS_PER_WAVE);
  const playerXpRef = useRef(0);
  const xpDropsRef = useRef([]);
  const playerHpRef = useRef(PLAYER_MAX_HP);
  const ingredientsRef = useRef({ rations: 0, herbs: 0, dust: 0 });
  const ingredientDropsRef = useRef([]);
  // Sync ref for playerHands so onStep can read current value without a dep
  const playerHandsRef = useRef({ left: null, right: null });
  playerHandsRef.current = playerHands;

  const adventurerDreadRateRef = useRef(1.0);
  adventurerDreadRateRef.current = adventurerDreadRate;
  const adventurerLootPerChestRef = useRef(10);
  adventurerLootPerChestRef.current = adventurerLootPerChest;
  const roomTempRiseRef = useRef(new Map());
  roomTempRiseRef.current = roomTempRise;

  // Explored mask — Uint8Array(W*H), 1 = cell has been seen by the player
  const exploredMaskRef = useRef(null);
  const firstTeaDeliveredRef = useRef(false);
  const firstWarmRoomTeaRef = useRef(false);

  // Track which adventurers have already reacted to spotting the ghost (player)
  const adventurerSightingsRef = useRef(new Set());

  // initialMobs is stable (useMemo on []), so we can read it from a ref too
  const mobSatiationsRef = useRef(null);
  if (mobSatiationsRef.current === null) {
    mobSatiationsRef.current = initialMobs.map(() => 40);
  }

  // Hidden passages
  const passagesRef = useRef([]);
  const [passageMask, setPassageMask] = useState(null);
  const [passageTraversal, _setPassageTraversal] = useState({ kind: "idle" });
  const passageTraversalRef = useRef({ kind: "idle" });
  function setPassageTraversal(s) {
    passageTraversalRef.current = s;
    _setPassageTraversal(s);
  }
  const traversalFactorRef = useRef(2.0);
  useEffect(() => {
    traversalFactorRef.current = traversalFactor;
  }, [traversalFactor]);
  const traversalStartRef = useRef({ totalSteps: 0, factor: 2.0 });

  const { play: playMainTheme } = useMusic(
    `${import.meta.env.BASE_URL}music/MUS_1_MainTheme_Cozy.ogg`,
    {
      volume: 1.0,
      loop: true,
    },
  );

  // Reset all game state whenever the dungeon regenerates
  useEffect(() => {
    const freshSatiations = initialMobs.map(() => 40);
    setPlayerHands({
      left: {
        id: crypto.randomUUID(),
        name: "Green Tea",
        recipe: RECIPES[0],
        temperature: 90,
        ruined: false,
      },
      right: null,
    });
    setMobSatiations(freshSatiations);
    setStoveStates(new Map());
    setShowRecipeMenu(false);
    setActiveStoveKey(null);
    setMessage(null);
    setAdventurers([]);
    setCurrentWave(0);
    setTurnCount(0);
    setWaveCountdown(turnsPerWave);
    setPlayerXp(0);
    setXpDrops([]);
    setPlayerHp(PLAYER_MAX_HP);
    setIngredients({ rations: 0, herbs: 0, dust: 0 });
    setIngredientDrops([...initialIngredientDrops]);
    setChests([...initialChests]);
    chestsRef.current = [...initialChests];
    setGameState("playing");
    setGameOverReason(null);
    adventurersRef.current = [];
    currentWaveRef.current = 0;
    turnCountRef.current = 0;
    waveCountdownRef.current = turnsPerWave;
    playerXpRef.current = 0;
    xpDropsRef.current = [];
    playerHpRef.current = PLAYER_MAX_HP;
    ingredientsRef.current = { rations: 0, herbs: 0, dust: 0 };
    ingredientDropsRef.current = [...initialIngredientDrops];
    mobSatiationsRef.current = freshSatiations;
    const freshPositions = initialMobs.map((m) => ({ x: m.x, z: m.z }));
    setMobPositions(freshPositions);
    mobPositionsRef.current = freshPositions;
    ruinedNotifiedRef.current = new Set();
    adventurerSightingsRef.current = new Set();
    firstTeaDeliveredRef.current = false;
    firstWarmRoomTeaRef.current = false;

    // Pre-explore exactly: kitchen (startRoomId) + one monster room + connecting corridor
    exploredMaskRef.current = buildInitialExploredMask(
      dungeon,
      dungeonWidth,
      dungeonHeight,
    );

    // Regenerate hidden passages
    const rng = makeContentRng(dungeonSeed ^ 0xabcdef);
    const { passages } = generateHiddenPassages(dungeon, rng, { count: 2 });
    passagesRef.current = passages;
    setPassageMask(
      buildPassageMask(dungeon.width, dungeon.height, { passages }),
    );
    setPassageTraversal({ kind: "idle" });

    playMainTheme();
    showMsg(
      "You have a Green Tea in hand — find the thirsty monsters and deliver it! (Press [space] Key)",
    );
  }, [dungeon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setChests([...initialChests]);
    chestsRef.current = [...initialChests];
  }, [initialChests]);

  const mobiles = useMemo(
    () => [
      ...initialMobs.map((m, i) => {
        const tmpl = MOB_TYPE_MAP[m.type];
        return {
          x: mobPositions[i].x,
          z: mobPositions[i].z,
          type: "mob",
          tileId: 0,
          color:
            mobSatiations[i] <= 0
              ? [0.25, 0.25, 0.25]
              : (STATUS_RGB[mobStatuses[i]] ?? STATUS_RGB.thirsty),
          geometrySize: tmpl?.geometrySize,
          uvRect: normalizeUvRect(tmpl?.uvRect, CHAR_SHEET_W, CHAR_SHEET_H),
        };
      }),
      ...adventurers
        .filter((a) => a.alive)
        .map((a) => {
          const tmpl = ADVENTURER_TYPE_MAP[a.template];
          return {
            x: a.x,
            z: a.z,
            type: "adventurer",
            tileId: 1,
            color: a.colorRgb,
            geometrySize: tmpl?.geometrySize,
            uvRect: normalizeUvRect(tmpl?.uvRect, CHAR_SHEET_W, CHAR_SHEET_H),
          };
        }),
    ],
    [initialMobs, mobPositions, mobStatuses, mobSatiations, adventurers],
  );

  // Resolve speech bubbles: look up current entity positions so bubbles follow movers
  const activeSpeechBubbles = useMemo(() => {
    return Object.entries(speechBubbles).flatMap(([entityId, bubble]) => {
      let x, z, speakerName;
      if (entityId.startsWith("mob_")) {
        const idx = parseInt(entityId.slice(4), 10);
        const mob = initialMobs[idx];
        if (!mob) return [];
        x = mobPositions[idx].x;
        z = mobPositions[idx].z;
        speakerName = mob.name;
      } else {
        const adv = adventurers.find((a) => a.id === entityId && a.alive);
        if (!adv) return [];
        x = adv.x;
        z = adv.z;
        speakerName = adv.name;
      }
      return [{ id: entityId, x, z, text: bubble.text, speakerName }];
    });
  }, [speechBubbles, initialMobs, mobPositions, adventurers]);

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
        const lootRng = makeRng(waveNum * 31337 + i * 7919 + 1);
        const dreadRng = makeRng(waveNum * 31337 + i * 7919 + 2);
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
          state: "exploring",
          loot: 0,
          dread: 0,
          lootThreshold: 20 + Math.floor(lootRng() * 31),
          dreadThreshold: 15 + Math.floor(dreadRng() * 26),
          noLootTurns: 0,
        });
      }
      return spawned;
    },
    [adventurerSpawnRooms, dungeonHeight, dungeonWidth],
  );

  // On each player step: cool tea, count down brewing, run game loop
  const onStep = useCallback(() => {
    console.log("[onStep] start, gameState:", gameState);
    if (gameState !== "playing") return;
    // --- Tea cooling ---
    // Check if player is in a warm or cozy room (roomTemp > 127)
    {
      const { x: cx, z: cz } = logicalRef.current;
      const cgx = Math.floor(cx);
      const cgz = Math.floor(cz);
      const playerRegionId = regionIdData[cgz * dungeonWidth + cgx];
      const playerBaseTemp = temperatureData[cgz * dungeonWidth + cgx] ?? 127;
      const playerRoomRise = roomTempRiseRef.current.get(playerRegionId) ?? 0;
      const playerRoomTemp = Math.min(
        255,
        playerBaseTemp + Math.round(playerRoomRise),
      );
      const inWarmRoom = playerRoomTemp > 127;

      const hands = playerHandsRef.current;
      const carryingTea = hands.left || hands.right;
      if (inWarmRoom && carryingTea && !firstWarmRoomTeaRef.current) {
        firstWarmRoomTeaRef.current = true;
        showMsg(
          "The warmth of this room keeps your tea from cooling too much — it won't drop below mid-range here!",
        );
      }

      setPlayerHands((prev) => {
        let changed = false;
        const next = { left: prev.left, right: prev.right };
        for (const hand of ["left", "right"]) {
          const tea = next[hand];
          if (!tea || tea.ruined) continue;
          const [lo, hi] = tea.recipe.idealTemperatureRange;
          const rawTemp = tea.temperature - tempDropPerStep;
          const newTemp = inWarmRoom
            ? Math.max(rawTemp, (lo + hi) / 2)
            : rawTemp;
          const ruined = newTemp < lo;
          next[hand] = { ...tea, temperature: newTemp, ruined };
          changed = true;
        }
        return changed ? next : prev;
      });
    }

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
    console.log("[onStep] tea cooling done, starting turn processing");
    const newTurnCount = turnCountRef.current + 1;
    turnCountRef.current = newTurnCount;

    let newAdventurers = [...adventurersRef.current];
    let newMobSatiations = mobSatiationsRef.current.map((s) =>
      Math.max(0, s - satiationDropPerStep),
    );
    let newMobPositions = mobPositionsRef.current.map((p) => ({ ...p }));
    let newWave = currentWaveRef.current;
    let newPlayerXp = playerXpRef.current;
    let newXpDrops = [...xpDropsRef.current];
    let newPlayerHp = playerHpRef.current;
    let newIngredients = { ...ingredientsRef.current };
    let newIngredientDrops = [...ingredientDropsRef.current];
    let newChests = [...chestsRef.current];
    let stepMessage = null;
    const pendingSpeechBubbles = []; // { entityId, text } collected during processing

    // --- Wave spawning ---
    // The countdown to the next wave only ticks when all enemies are dead.
    console.log(
      "[onStep] wave spawning check, turn:",
      newTurnCount,
      "countdown:",
      waveCountdownRef.current,
    );
    const allEnemiesDead = newAdventurers.every((a) => !a.alive);
    let newWaveCountdown = waveCountdownRef.current;
    if (allEnemiesDead) {
      newWaveCountdown -= 1;
    }
    if (newWaveCountdown <= 0) {
      newWaveCountdown = turnsPerWave;
      newWave = currentWaveRef.current + 1;
      currentWaveRef.current = newWave;
      const spawned = spawnAdventurersForWave(newWave);
      newAdventurers = [...newAdventurers.filter((a) => a.alive), ...spawned];
      stepMessage = `Wave ${newWave}! ${spawned.length} adventurer${spawned.length !== 1 ? "s" : ""} have entered the dungeon!`;
    }
    waveCountdownRef.current = newWaveCountdown;

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

    // --- Ingredient pickup ---
    const remainingIngDrops = [];
    for (const drop of newIngredientDrops) {
      if (drop.x === pgx && drop.z === pgz) {
        newIngredients = {
          ...newIngredients,
          [drop.id]: (newIngredients[drop.id] ?? 0) + 1,
        };
        stepMessage = `Collected ${drop.name}!`;
      } else {
        remainingIngDrops.push(drop);
      }
    }
    newIngredientDrops = remainingIngDrops;

    // --- Adventurer AI ---
    function isWalkable(x, z) {
      if (x < 0 || z < 0 || x >= dungeonWidth || z >= dungeonHeight)
        return false;
      return solidData[z * dungeonWidth + x] === 0;
    }

    // Closed doors block LOS. A door is open if any creature occupies its cell.
    const stepOccupied = new Set([
      `${pgx}_${pgz}`,
      ...newMobPositions.map((p) => `${p.x}_${p.z}`),
      ...newAdventurers.filter((a) => a.alive).map((a) => `${a.x}_${a.z}`),
    ]);
    const closedDoorCells = new Set(
      doorPlacements
        .filter(
          (d) =>
            d.type.startsWith("door") && !stepOccupied.has(`${d.x}_${d.z}`),
        )
        .map((d) => `${d.x}_${d.z}`),
    );
    function isWalkableForLos(x, z) {
      if (!isWalkable(x, z)) return false;
      return !closedDoorCells.has(`${x}_${z}`);
    }

    // Update explored mask: mark all cells visible from current player position
    if (exploredMaskRef.current) {
      const mask = exploredMaskRef.current;
      for (let dz = -LOS_RADIUS; dz <= LOS_RADIUS; dz++) {
        for (let dx = -LOS_RADIUS; dx <= LOS_RADIUS; dx++) {
          if (dx * dx + dz * dz > LOS_RADIUS * LOS_RADIUS) continue;
          const tx = pgx + dx;
          const tz = pgz + dz;
          if (tx < 0 || tz < 0 || tx >= dungeonWidth || tz >= dungeonHeight)
            continue;
          if (hasLineOfSight(pgx, pgz, tx, tz, isWalkableForLos)) {
            mask[tz * dungeonWidth + tx] = 1;
          }
        }
      }
    }

    // Phase 1 — compute intended moves (adventurers are transparent to each other)
    console.log(
      "[onStep] Phase 1: adventurer AI, count:",
      newAdventurers.filter((a) => a.alive).length,
    );
    const mobPlayerOccupied = new Set([
      ...newMobPositions.map((p) => `${p.x}_${p.z}`),
    ]);

    const intendedMoves = newAdventurers.map((advInit) => {
      let adv = advInit;
      if (!adv.alive)
        return {
          adv,
          intendedX: adv.x,
          intendedZ: adv.z,
          debugPath: [],
          isAttack: false,
          inCombat: false,
        };

      // Ghost sighting: adventurer spots the ghost (player) for the first time
      if (!adventurerSightingsRef.current.has(adv.id)) {
        const playerDist = Math.hypot(adv.x - pgx, adv.z - pgz);
        if (
          playerDist <= GHOST_SIGHT_RADIUS &&
          hasLineOfSight(adv.x, adv.z, pgx, pgz, isWalkableForLos)
        ) {
          adventurerSightingsRef.current.add(adv.id);
          const hasTeaInHand = !!(
            playerHandsRef.current.left || playerHandsRef.current.right
          );
          const pool = hasTeaInHand ? GHOST_DIALOG_WITH_TEA : GHOST_DIALOG;
          pendingSpeechBubbles.push({
            entityId: adv.id,
            text: pool[Math.floor(Math.random() * pool.length)],
          });
        }
      }

      // Factions: adventurers are hostile to monsters, neutral to player.
      // Priority: fight any conscious monster in line of sight; otherwise use state machine.

      // Find nearest visible (line-of-sight) conscious monster
      let combatTarget = null;
      let combatDist = Infinity;
      for (let i = 0; i < initialMobs.length; i++) {
        if (newMobSatiations[i] <= 0) continue; // unconscious
        const mobPos = newMobPositions[i];
        const d = Math.hypot(adv.x - mobPos.x, adv.z - mobPos.z);
        if (
          d < combatDist &&
          hasLineOfSight(adv.x, adv.z, mobPos.x, mobPos.z, isWalkableForLos)
        ) {
          combatDist = d;
          combatTarget = { x: mobPos.x, z: mobPos.z, type: "mob", idx: i };
        }
      }

      if (combatTarget) {
        // Adjacent to monster: attack
        const ddx = combatTarget.x - adv.x;
        const ddz = combatTarget.z - adv.z;
        if (Math.abs(ddx) + Math.abs(ddz) === 1) {
          const damage = Math.max(1, adv.attack - MOB_DEFENSE);
          newMobSatiations[combatTarget.idx] = Math.max(
            0,
            newMobSatiations[combatTarget.idx] - damage,
          );
          if (newMobSatiations[combatTarget.idx] <= 0) {
            stepMessage = `${initialMobs[combatTarget.idx].name} has fallen unconscious!`;
          }
          return {
            adv,
            intendedX: adv.x,
            intendedZ: adv.z,
            debugPath: [],
            isAttack: true,
            inCombat: true,
          };
        }
        // Move toward monster
        const combatAstar = aStar8(
          { width: dungeonWidth, height: dungeonHeight },
          (x, y) => isWalkable(x, y),
          { x: adv.x, y: adv.z },
          { x: combatTarget.x, y: combatTarget.z },
          {
            isBlocked: (x, y) =>
              mobPlayerOccupied.has(`${x}_${y}`) &&
              !(x === combatTarget.x && y === combatTarget.z),
            fourDir: true,
          },
        );
        if (combatAstar && combatAstar.path.length > 1) {
          const step = combatAstar.path[1];
          const debugPath = combatAstar.path
            .slice(2)
            .map((p) => ({ x: p.x, z: p.y }));
          return {
            adv,
            intendedX: step.x,
            intendedZ: step.y,
            debugPath,
            isAttack: false,
            inCombat: true,
          };
        }
        return {
          adv,
          intendedX: adv.x,
          intendedZ: adv.z,
          debugPath: [],
          isAttack: false,
          inCombat: true,
        };
      }

      // No combat target: use state machine
      const advState = adv.state ?? "exploring";

      if (advState === "exploring") {
        // Compute current room temperature
        const regionId = regionIdData[adv.z * dungeonWidth + adv.x];
        const baseTemp = temperatureData[adv.z * dungeonWidth + adv.x] ?? 127;
        const rise = roomTempRiseRef.current.get(regionId) ?? 0;
        const roomTemp = Math.min(255, baseTemp + Math.round(rise));

        // Update dread
        let newDread = adv.dread ?? 0;
        if (roomTemp <= 127) {
          newDread = newDread + adventurerDreadRateRef.current;
        } else {
          newDread = Math.max(
            0,
            newDread - adventurerDreadRateRef.current * 0.5,
          );
        }

        // Check chest pickup
        let newLoot = adv.loot ?? 0;
        const chestIdx = newChests.findIndex(
          (c) => c.x === adv.x && c.z === adv.z,
        );
        if (chestIdx !== -1) {
          newLoot += adventurerLootPerChestRef.current;
          newChests.splice(chestIdx, 1);
        }

        // Check state transition
        const NO_LOOT_TURNS_LIMIT = 10;
        let newAdvState = "exploring";
        if (
          (newDread >= (adv.dreadThreshold ?? 15) &&
            newLoot >= (adv.lootThreshold ?? 20)) ||
          (adv.noLootTurns ?? 0) >= NO_LOOT_TURNS_LIMIT
        ) {
          newAdvState = "seeking";
          pendingSpeechBubbles.push({
            entityId: adv.id,
            text: ADVENTURER_SEEKING_DIALOG[
              Math.floor(Math.random() * ADVENTURER_SEEKING_DIALOG.length)
            ],
          });
        }

        if (newAdvState === "exploring") {
          // Pathfind to nearest chest
          let chestTarget = null;
          let chestDist = Infinity;
          for (const chest of newChests) {
            const d = Math.hypot(adv.x - chest.x, adv.z - chest.z);
            if (d < chestDist) {
              chestDist = d;
              chestTarget = { x: chest.x, z: chest.z };
            }
          }

          if (chestTarget) {
            const chestAstar = aStar8(
              { width: dungeonWidth, height: dungeonHeight },
              (x, y) => isWalkable(x, y),
              { x: adv.x, y: adv.z },
              { x: chestTarget.x, y: chestTarget.z },
              {
                isBlocked: (x, y) => mobPlayerOccupied.has(`${x}_${y}`),
                fourDir: true,
              },
            );
            if (chestAstar && chestAstar.path.length > 1) {
              const step = chestAstar.path[1];
              const debugPath = chestAstar.path
                .slice(2)
                .map((p) => ({ x: p.x, z: p.y }));
              adv = {
                ...adv,
                dread: newDread,
                loot: newLoot,
                state: newAdvState,
                noLootTurns: 0,
              };
              return {
                adv,
                intendedX: step.x,
                intendedZ: step.y,
                debugPath,
                isAttack: false,
                inCombat: false,
              };
            }
            // Chest exists but is unreachable — count the stuck turn
            adv = {
              ...adv,
              dread: newDread,
              loot: newLoot,
              state: newAdvState,
              noLootTurns: (adv.noLootTurns ?? 0) + 1,
            };
            return {
              adv,
              intendedX: adv.x,
              intendedZ: adv.z,
              debugPath: [],
              isAttack: false,
              inCombat: false,
            };
          }

          // No chests at all — count the stuck turn and wander
          const newNoLootTurns = (adv.noLootTurns ?? 0) + 1;
          const nonEndRoomsArray = [...dungeon.rooms.entries()].filter(
            ([id]) => id !== dungeon.endRoomId,
          );
          if (nonEndRoomsArray.length > 0) {
            const roomPickIdx =
              (adv.id.charCodeAt(4) ?? 0) % nonEndRoomsArray.length;
            const [, wanderRoom] = nonEndRoomsArray[roomPickIdx];
            const wx = wanderRoom.rect.x + Math.floor(wanderRoom.rect.w / 2);
            const wz = wanderRoom.rect.y + Math.floor(wanderRoom.rect.h / 2);
            const wanderAstar = aStar8(
              { width: dungeonWidth, height: dungeonHeight },
              (x, y) => isWalkable(x, y),
              { x: adv.x, y: adv.z },
              { x: wx, y: wz },
              {
                isBlocked: (x, y) => mobPlayerOccupied.has(`${x}_${y}`),
                fourDir: true,
              },
            );
            if (wanderAstar && wanderAstar.path.length > 1) {
              const step = wanderAstar.path[1];
              const debugPath = wanderAstar.path
                .slice(2)
                .map((p) => ({ x: p.x, z: p.y }));
              adv = {
                ...adv,
                dread: newDread,
                loot: newLoot,
                state: newAdvState,
                noLootTurns: newNoLootTurns,
              };
              return {
                adv,
                intendedX: step.x,
                intendedZ: step.y,
                debugPath,
                isAttack: false,
                inCombat: false,
              };
            }
          }
          adv = {
            ...adv,
            dread: newDread,
            loot: newLoot,
            state: newAdvState,
            noLootTurns: newNoLootTurns,
          };
          return {
            adv,
            intendedX: adv.x,
            intendedZ: adv.z,
            debugPath: [],
            isAttack: false,
            inCombat: false,
          };
        }

        // State just switched to seeking — fall through to seeking logic below
        adv = { ...adv, dread: newDread, loot: newLoot, state: "seeking" };
      }

      // seeking state: pathfind to nearest stove
      let stoveTarget = null;
      let stoveDist = Infinity;
      for (const stove of stovePlacements) {
        const d = Math.hypot(adv.x - stove.x, adv.z - stove.z);
        if (d < stoveDist) {
          stoveDist = d;
          stoveTarget = { x: stove.x, z: stove.z };
        }
      }

      if (!stoveTarget)
        return {
          adv,
          intendedX: adv.x,
          intendedZ: adv.z,
          debugPath: [],
          isAttack: false,
          inCombat: false,
        };

      const stoveAstar = aStar8(
        { width: dungeonWidth, height: dungeonHeight },
        (x, y) => isWalkable(x, y),
        { x: adv.x, y: adv.z },
        { x: stoveTarget.x, y: stoveTarget.z },
        {
          isBlocked: (x, y) => mobPlayerOccupied.has(`${x}_${y}`),
          fourDir: true,
        },
      );
      if (stoveAstar && stoveAstar.path.length > 1) {
        const step = stoveAstar.path[1];
        const debugPath = stoveAstar.path
          .slice(2)
          .map((p) => ({ x: p.x, z: p.y }));
        return {
          adv,
          intendedX: step.x,
          intendedZ: step.y,
          debugPath,
          isAttack: false,
          inCombat: false,
        };
      }
      return {
        adv,
        intendedX: adv.x,
        intendedZ: adv.z,
        debugPath: [],
        isAttack: false,
        inCombat: false,
      };
    });

    const anyInCombat = intendedMoves.some((m) => m.inCombat);
    console.log("[onStep] Phase 1 done, anyInCombat:", anyInCombat);

    if (anyInCombat) {
      // Phase 2 — detect swap pairs
      const swapSet = new Set(); // indices of adventurers in a direct swap
      for (let i = 0; i < intendedMoves.length; i++) {
        const mi = intendedMoves[i];
        if (!mi.adv.alive || mi.isAttack) continue;
        if (mi.intendedX === mi.adv.x && mi.intendedZ === mi.adv.z) continue;
        for (let j = i + 1; j < intendedMoves.length; j++) {
          const mj = intendedMoves[j];
          if (!mj.adv.alive || mj.isAttack) continue;
          if (
            mi.intendedX === mj.adv.x &&
            mi.intendedZ === mj.adv.z &&
            mj.intendedX === mi.adv.x &&
            mj.intendedZ === mi.adv.z
          ) {
            swapSet.add(i);
            swapSet.add(j);
          }
        }
      }

      // Phase 3 — resolve final positions with collision
      const committed = new Set(mobPlayerOccupied);
      // Pre-commit swap destinations (guaranteed to execute)
      for (const idx of swapSet) {
        committed.add(
          `${intendedMoves[idx].intendedX}_${intendedMoves[idx].intendedZ}`,
        );
      }
      // Pre-commit positions of stationary adventurers (attacking, dead, or no path)
      for (let i = 0; i < intendedMoves.length; i++) {
        if (swapSet.has(i)) continue;
        const { adv, intendedX, intendedZ, isAttack } = intendedMoves[i];
        if (
          !adv.alive ||
          isAttack ||
          (intendedX === adv.x && intendedZ === adv.z)
        ) {
          committed.add(`${adv.x}_${adv.z}`);
        }
      }

      newAdventurers = intendedMoves.map((move, i) => {
        const { adv, intendedX, intendedZ, debugPath, isAttack } = move;
        if (!adv.alive) return adv;

        // Stationary (attack or no path)
        if (isAttack || (intendedX === adv.x && intendedZ === adv.z)) {
          return { ...adv, debugPath: [] };
        }

        // Swap pair — guaranteed move
        if (swapSet.has(i)) {
          return { ...adv, x: intendedX, z: intendedZ, debugPath };
        }

        // Non-swap mover — greedy claim
        const targetKey = `${intendedX}_${intendedZ}`;
        if (!committed.has(targetKey)) {
          committed.add(targetKey);
          return { ...adv, x: intendedX, z: intendedZ, debugPath };
        }
        // Blocked — stay
        return { ...adv, debugPath: [] };
      });
    } else {
      // No monsters in LOS — adventurers pass through each other freely.
      // Only player and mob positions are respected as hard blocks.
      newAdventurers = intendedMoves.map((move) => {
        const { adv, intendedX, intendedZ, debugPath, isAttack } = move;
        if (!adv.alive) return adv;
        if (isAttack || (intendedX === adv.x && intendedZ === adv.z)) {
          return { ...adv, debugPath: [] };
        }
        if (mobPlayerOccupied.has(`${intendedX}_${intendedZ}`)) {
          return { ...adv, debugPath: [] };
        }
        return { ...adv, x: intendedX, z: intendedZ, debugPath };
      });
    }

    // --- Adventurers pick up loot they've walked onto ---
    for (const adv of newAdventurers) {
      if (!adv.alive) continue;
      const lootIdx = newIngredientDrops.findIndex(
        (d) => d.x === adv.x && d.z === adv.z,
      );
      if (lootIdx !== -1) {
        const loot = newIngredientDrops.splice(lootIdx, 1)[0];
        stepMessage = `The ${adv.name} snatched the ${loot.name}!`;
      }
    }

    // --- Conscious mob AI: move toward nearest adventurer in line of sight ---
    console.log("[onStep] mob AI start");
    for (let i = 0; i < initialMobs.length; i++) {
      if (newMobSatiations[i] <= 0) continue; // unconscious
      const pos = newMobPositions[i];

      // Find nearest visible adventurer within LOS_RADIUS
      let chaseTarget = null;
      let chaseDist = Infinity;
      for (const adv of newAdventurers) {
        if (!adv.alive) continue;
        const d = Math.hypot(pos.x - adv.x, pos.z - adv.z);
        if (
          d < chaseDist &&
          d <= LOS_RADIUS &&
          hasLineOfSight(pos.x, pos.z, adv.x, adv.z, isWalkableForLos)
        ) {
          chaseDist = d;
          chaseTarget = adv;
        }
      }

      if (!chaseTarget) continue;
      // Already adjacent — counterattack section handles damage
      if (
        Math.abs(pos.x - chaseTarget.x) + Math.abs(pos.z - chaseTarget.z) ===
        1
      )
        continue;

      // Pathfind one step toward the adventurer
      const mobAstar = aStar8(
        { width: dungeonWidth, height: dungeonHeight },
        (x, y) => isWalkableForLos(x, y),
        { x: pos.x, y: pos.z },
        { x: chaseTarget.x, y: chaseTarget.z },
        { fourDir: true },
      );
      if (mobAstar && mobAstar.path.length > 1) {
        const step = mobAstar.path[1];
        // Don't step onto another mob's cell
        const blockedByMob = newMobPositions.some(
          (p, j) => j !== i && p.x === step.x && p.z === step.y,
        );
        if (!blockedByMob) {
          newMobPositions[i] = { x: step.x, z: step.y };
        }
      }
    }

    // --- Conscious mob counterattack ---
    for (let i = 0; i < initialMobs.length; i++) {
      if (newMobSatiations[i] <= 0) continue; // unconscious
      const mob = initialMobs[i];
      const mobPos = newMobPositions[i];
      for (let j = 0; j < newAdventurers.length; j++) {
        const adv = newAdventurers[j];
        if (!adv.alive) continue;
        if (Math.abs(adv.x - mobPos.x) + Math.abs(adv.z - mobPos.z) === 1) {
          const damage = Math.max(1, mob.attack - adv.defense);
          const newHp = adv.hp - damage;
          if (newHp <= 0) {
            newAdventurers[j] = { ...adv, alive: false, hp: 0 };
            const dreadFactor =
              (adv.dreadThreshold ?? 0) > 0
                ? Math.min(1, (adv.dread ?? 0) / adv.dreadThreshold)
                : 0;
            const lootFactor =
              (adv.lootThreshold ?? 0) > 0
                ? Math.min(1, (adv.loot ?? 0) / adv.lootThreshold)
                : 0;
            const xpReward = Math.round(
              adv.xp * (1 + dreadFactor + lootFactor),
            );
            newXpDrops.push({
              id: `xp_${Date.now()}_${j}`,
              x: adv.x,
              z: adv.z,
              amount: xpReward,
            });
            // Drop ingredient based on adventurer type
            const tmpl = ADVENTURER_TYPES.find((t) => t.type === adv.template);
            if (tmpl?.drop) {
              newIngredientDrops.push({
                id: tmpl.drop.id,
                name: tmpl.drop.name,
                x: adv.x,
                z: adv.z,
                dropKey: `ing_${Date.now()}_${j}`,
              });
            }
            stepMessage = `${mob.name} slew the ${adv.name}! (+${xpReward} XP, ${tmpl?.drop?.name ?? "?"} dropped)`;
          } else {
            newAdventurers[j] = { ...adv, hp: newHp };
          }
          break; // each mob attacks at most one adventurer per step
        }
      }
    }

    // --- Tea station game-over: any adventurer on a stove tile ---
    const stoveSet = new Set(stovePlacements.map((s) => `${s.x}_${s.z}`));
    for (const adv of newAdventurers) {
      if (!adv.alive) continue;
      if (stoveSet.has(`${adv.x}_${adv.z}`)) {
        setGameState("gameover");
        setGameOverReason(`The ${adv.name} smashed your tea station!`);
        return;
      }
    }

    // --- Player HP game-over ---
    if (newPlayerHp <= 0) {
      setGameState("gameover");
      setGameOverReason("You have been defeated by the adventurers!");
      return;
    }

    // --- Win condition ---
    if (newWave >= WIN_WAVES) {
      setGameState("won");
      return;
    }

    // --- Commit all ref + state updates ---
    console.log("[onStep] committing state updates");
    adventurersRef.current = newAdventurers;
    currentWaveRef.current = newWave;
    playerXpRef.current = newPlayerXp;
    xpDropsRef.current = newXpDrops;
    playerHpRef.current = newPlayerHp;
    ingredientsRef.current = newIngredients;
    ingredientDropsRef.current = newIngredientDrops;
    chestsRef.current = newChests;
    mobSatiationsRef.current = newMobSatiations;
    mobPositionsRef.current = newMobPositions;

    setTurnCount(newTurnCount);
    setWaveCountdown(newWaveCountdown);
    setCurrentWave(newWave);
    setAdventurers([...newAdventurers]);
    setPlayerXp(newPlayerXp);
    setXpDrops([...newXpDrops]);
    setPlayerHp(newPlayerHp);
    setIngredients(newIngredients);
    setIngredientDrops([...newIngredientDrops]);
    setChests([...newChests]);
    setMobSatiations(newMobSatiations);
    setMobPositions([...newMobPositions]);

    // --- Room heating from cozy objects (stoves) + temperature flow between rooms ---
    const cozyByRegion = new Map();
    for (const s of stovePlacements) {
      if (s.type !== "stove") continue;
      const regionId = regionIdData[s.z * dungeonWidth + s.x];
      cozyByRegion.set(regionId, (cozyByRegion.get(regionId) ?? 0) + 1);
    }
    setRoomTempRise((prev) => {
      const next = new Map(prev);

      // Apply heating from cozy objects
      for (const [regionId, count] of cozyByRegion) {
        next.set(
          regionId,
          Math.min(128, (next.get(regionId) ?? 0) + count * heatingPerStep),
        );
      }

      // Flow temperature between adjacent region pairs (each pair processed once)
      for (const [a, b] of regionAdjacency) {
        const riseA = next.get(a) ?? 0;
        const riseB = next.get(b) ?? 0;
        if (riseA === riseB) continue;
        const flow = (riseA - riseB) * 0.1;
        next.set(a, riseA - flow);
        next.set(b, riseB + flow);
      }

      return next;
    });

    console.log("[onStep] done, turn:", newTurnCount);
    if (stepMessage) showMsg(stepMessage);
    for (const { entityId, text } of pendingSpeechBubbles) {
      showSpeechBubble(entityId, text, 6000);
    }
  }, [
    gameState,
    tempDropPerStep,
    heatingPerStep,
    satiationDropPerStep,
    solidData,
    regionIdData,
    regionAdjacency,
    dungeonWidth,
    dungeonHeight,
    turnsPerWave,
    temperatureData,
    dungeon,
    initialMobs,
    showMsg,
    showSpeechBubble,
    spawnAdventurersForWave,
    stovePlacements,
    doorPlacements,
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

  const onBlockedMove = useCallback((dx, dz) => {
    const passages = passagesRef.current;
    if (!passages.length) return;
    const { x, z } = logicalRef.current;
    const px = Math.floor(x);
    const pz = Math.floor(z);
    for (const p of passages) {
      if (!p.enabled) continue;
      const traversal = startPassageTraversal(p, { x: px, y: pz });
      if (!traversal || traversal.kind !== "active") continue;
      const first = traversal.remainingCells[0];
      if (first.x === px + dx && first.y === pz + dz) {
        traversalStartRef.current = {
          totalSteps: traversal.remainingCells.length,
          factor: traversalFactorRef.current,
        };
        setPassageTraversal(traversal);
        showMsg("Entering secret passage…");
        return;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { camera, logicalRef, doMove } = useEotBCamera(
    solidData,
    dungeonWidth,
    dungeonHeight,
    spawnX,
    spawnZ,
    {
      onStep,
      blocked: showRecipeMenu || gameState !== "playing",
      onBlockedMove,
      canPhaseWalls: !playerHands.left && !playerHands.right,
      keybindings,
      startYaw: spawnYaw,
    },
  );

  // Cells currently occupied by the player or any creature — used to open doors
  const doorOccupiedKeys = useMemo(() => {
    const keys = new Set();
    keys.add(`${Math.floor(camera.x)}_${Math.floor(camera.z)}`);
    for (const pos of mobPositions) keys.add(`${pos.x}_${pos.z}`);
    for (const adv of adventurers) {
      if (adv.alive) keys.add(`${adv.x}_${adv.z}`);
    }
    return keys;
  }, [camera.x, camera.z, mobPositions, adventurers]);

  // Passage traversal step-loop
  useEffect(() => {
    if (passageTraversal.kind !== "active") return;
    const { cell, next } = consumePassageStep(passageTraversal);
    setPassageTraversal(next);
    const { x, z } = logicalRef.current;
    doMove(cell.x + 0.5 - x, cell.y + 0.5 - z);
    if (next.kind === "idle") {
      const { totalSteps, factor } = traversalStartRef.current;
      const turns = Math.round(totalSteps / factor);
      showMsg(
        `Secret passage traversed — ${totalSteps} step${totalSteps !== 1 ? "s" : ""} (${turns} turn${turns !== 1 ? "s" : ""} at ${factor}×).`,
      );
    }
  }, [passageTraversal]); // eslint-disable-line react-hooks/exhaustive-deps

  // togglePassage key — toggle passage at player position
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      if (passageTraversal.kind === "active") {
        setPassageTraversal(cancelPassageTraversal());
        return;
      }
      const passages = passagesRef.current;
      if (!passages.length || !passageMask) return;
      const { x, z } = logicalRef.current;
      const px = Math.floor(x);
      const pz = Math.floor(z);
      for (const p of passages) {
        if (
          (p.start.x === px && p.start.y === pz) ||
          (p.end.x === px && p.end.y === pz)
        ) {
          p.enabled = !p.enabled;
          const newMask = new Uint8Array(passageMask);
          if (p.enabled) {
            enablePassageInMask(newMask, dungeonWidth, p);
            showMsg("Passage unlocked!");
          } else {
            disablePassageInMask(newMask, dungeonWidth, p);
            showMsg("Passage locked.");
          }
          setPassageMask(newMask);
          return;
        }
      }
      showMsg("Nothing to interact with here.");
    };
    const keys = keybindings.togglePassage.join(",");
    if (keys) hotkeys(keys, handler);
    return () => {
      if (keys) hotkeys.unbind(keys, handler);
    };
  }, [passageTraversal, passageMask, dungeonWidth, showMsg, keybindings]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const mi = mobPositions.findIndex((p) => p.x === tx && p.z === tz);
    if (mi !== -1) return { type: "mob", mobIdx: mi };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, stovePlacements, mobPositions]);

  // Interaction prompt text
  const promptText = useMemo(() => {
    if (!facingTarget) return null;
    if (facingTarget.type === "stove") {
      const state = stoveStates.get(facingTarget.stoveKey);
      if (!state?.brewing) return "Stove — Press [space] to brew tea";
      if (state.brewing.ready)
        return `${state.brewing.recipe.name} is ready! — Press [space] to collect`;
      return `Brewing ${state.brewing.recipe.name}: ${state.brewing.stepsRemaining} steps — Press [space] for status`;
    }
    const mob = initialMobs[facingTarget.mobIdx];
    const preferredRecipe = RECIPES.find(
      (r) => r.id === mob?.preferredRecipeId,
    );
    const isUnconscious = mobSatiations[facingTarget.mobIdx] <= 0;
    if (isUnconscious) {
      return `${mob?.name} is unconscious — Press [space] to offer tea to revive`;
    }
    return `${mob?.name} [prefers ${preferredRecipe?.name ?? "?"}] — Press [space] to offer tea`;
  }, [facingTarget, stoveStates, initialMobs, mobSatiations]);

  // interact / recipe menu navigation
  useEffect(() => {
    function doInteract() {
      if (!facingTarget) return;
      if (gameState !== "playing") return;

      if (facingTarget.type === "stove") {
        const state = stoveStates.get(facingTarget.stoveKey);
        if (!state?.brewing) {
          setActiveStoveKey(facingTarget.stoveKey);
          setRecipeMenuCursor(0);
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
        const mobBubbleId = `mob_${facingTarget.mobIdx}`;
        if (tea && !isUnconscious && mobStatus === "ecstatic") {
          showSpeechBubble(
            mobBubbleId,
            "Oh, I couldn't possibly! I'm far too full right now — perhaps later.",
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
          showSpeechBubble(
            mobBubbleId,
            `I'd love some ${preferredRecipe?.name ?? "tea"}... ${thirstLine}`,
          );
          return;
        }
        const [lo, hi] = tea.recipe.idealTemperatureRange;
        setPlayerHands((prev) => ({ ...prev, [hand]: null }));
        if (!firstTeaDeliveredRef.current) {
          firstTeaDeliveredRef.current = true;
          showMsg(
            `Head back to the tea machine (stove) in the kitchen and press [${keybindings.interact[0] === " " ? "space" : keybindings.interact[0]}] to brew another tea!`,
          );
          setTimeout(() => {
            showMsg(
              "With empty hands you can pass through walls — explore the dungeon!",
            );
          }, 5500);
        }
        function applyMobSatiation(value) {
          const next = [...mobSatiationsRef.current];
          next[facingTarget.mobIdx] = value;
          mobSatiationsRef.current = next;
          setMobSatiations(next);
        }
        if (tea.ruined || tea.temperature < lo) {
          applyMobSatiation(10);
          showSpeechBubble(
            mobBubbleId,
            `This ${tea.name} is cold and ruined... How disappointing.`,
          );
        } else if (tea.temperature > hi) {
          applyMobSatiation(30);
          showSpeechBubble(
            mobBubbleId,
            `Ouch! This ${tea.name} is scalding hot! Dreadfully disappointing.`,
          );
        } else {
          const isPreferred = mob.preferredRecipeId === tea.recipe.id;
          const bonus = isPreferred ? 100 * (supersatiationBonus / 100) : 0;
          applyMobSatiation(100 + bonus);
          if (isPreferred) {
            showSpeechBubble(
              mobBubbleId,
              `My favourite! This ${tea.name} is absolutely perfect — I am overjoyed!`,
            );
          } else {
            showSpeechBubble(
              mobBubbleId,
              `Ahh, thank you! This ${tea.name} is perfectly brewed — most refreshing!`,
            );
          }
        }
      }
    }

    const interactHandler = (e) => {
      e.preventDefault();
      if (showRecipeMenu) {
        setShowRecipeMenu(false);
        return;
      }
      doInteract();
    };
    const waitHandler = (e) => {
      if (showRecipeMenu) return;
      e.preventDefault();
      onStep();
    };
    const discardLeftHandler = (e) => {
      if (showRecipeMenu) return;
      e.preventDefault();
      if (gameState !== "playing") return;
      if (playerHands.left) {
        showMsg(`You discard your ${playerHands.left.name}.`);
        setPlayerHands((prev) => ({ ...prev, left: null }));
        if (!firstTeaDeliveredRef.current) {
          firstTeaDeliveredRef.current = true;
          setTimeout(() => {
            showMsg(
              "With empty hands you can pass through walls — explore the dungeon!",
            );
          }, 1500);
        }
      } else {
        showMsg("Your left hand is empty.");
      }
    };
    const discardRightHandler = (e) => {
      if (showRecipeMenu) return;
      e.preventDefault();
      if (gameState !== "playing") return;
      if (playerHands.right) {
        showMsg(`You discard your ${playerHands.right.name}.`);
        setPlayerHands((prev) => ({ ...prev, right: null }));
        if (!firstTeaDeliveredRef.current) {
          firstTeaDeliveredRef.current = true;
          setTimeout(() => {
            showMsg(
              "With empty hands you can pass through walls — explore the dungeon!",
            );
          }, 1500);
        }
      } else {
        showMsg("Your right hand is empty.");
      }
    };
    const recipeCloseHandler = (e) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      setShowRecipeMenu(false);
    };
    const recipeSelectHandler = (e) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      const num = parseInt(e.key);
      if (num >= 1 && num <= RECIPES.length) {
        const recipe = RECIPES[num - 1];
        if (
          recipe.ingredientId &&
          (ingredients[recipe.ingredientId] ?? 0) < 1
        ) {
          showMsg(`You need ${recipe.ingredientName} to brew ${recipe.name}!`);
          return;
        }
        if (recipe.ingredientId) {
          const newIng = {
            ...ingredientsRef.current,
            [recipe.ingredientId]:
              ingredientsRef.current[recipe.ingredientId] - 1,
          };
          ingredientsRef.current = newIng;
          setIngredients(newIng);
        }
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
    };

    const recipeOptionNextHandler = (e) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      setRecipeMenuCursor((c) => (c + 1) % RECIPES.length);
    };
    const recipeOptionPrevHandler = (e) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      setRecipeMenuCursor((c) => (c - 1 + RECIPES.length) % RECIPES.length);
    };
    const recipeOptionSelectHandler = (e) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      const recipe = RECIPES[recipeMenuCursor];
      if (!recipe) return;
      if (
        recipe.ingredientId &&
        (ingredientsRef.current[recipe.ingredientId] ?? 0) < 1
      ) {
        showMsg(`You need ${recipe.ingredientName} to brew ${recipe.name}!`);
        return;
      }
      if (recipe.ingredientId) {
        const newIng = {
          ...ingredientsRef.current,
          [recipe.ingredientId]:
            ingredientsRef.current[recipe.ingredientId] - 1,
        };
        ingredientsRef.current = newIng;
        setIngredients(newIng);
      }
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
    };

    const interactKeys = keybindings.interact.join(",");
    const waitKeys = keybindings.wait.join(",");
    const discardLeftKeys = keybindings.discardLeft.join(",");
    const discardRightKeys = keybindings.discardRight.join(",");
    const optionNextKeys = (keybindings.optionNext ?? []).join(",");
    const optionPrevKeys = (keybindings.optionPrev ?? []).join(",");
    const optionSelectKeys = (keybindings.optionSelect ?? []).join(",");

    if (interactKeys) hotkeys(interactKeys, interactHandler);
    if (waitKeys) hotkeys(waitKeys, waitHandler);
    if (discardLeftKeys) hotkeys(discardLeftKeys, discardLeftHandler);
    if (discardRightKeys) hotkeys(discardRightKeys, discardRightHandler);
    if (optionNextKeys) hotkeys(optionNextKeys, recipeOptionNextHandler);
    if (optionPrevKeys) hotkeys(optionPrevKeys, recipeOptionPrevHandler);
    if (optionSelectKeys) hotkeys(optionSelectKeys, recipeOptionSelectHandler);
    hotkeys("escape", recipeCloseHandler);
    hotkeys("1,2,3,4,5,6,7,8,9", recipeSelectHandler);

    return () => {
      if (interactKeys) hotkeys.unbind(interactKeys, interactHandler);
      if (waitKeys) hotkeys.unbind(waitKeys, waitHandler);
      if (discardLeftKeys) hotkeys.unbind(discardLeftKeys, discardLeftHandler);
      if (discardRightKeys)
        hotkeys.unbind(discardRightKeys, discardRightHandler);
      if (optionNextKeys)
        hotkeys.unbind(optionNextKeys, recipeOptionNextHandler);
      if (optionPrevKeys)
        hotkeys.unbind(optionPrevKeys, recipeOptionPrevHandler);
      if (optionSelectKeys)
        hotkeys.unbind(optionSelectKeys, recipeOptionSelectHandler);
      hotkeys.unbind("escape", recipeCloseHandler);
      hotkeys.unbind("1,2,3,4,5,6,7,8,9", recipeSelectHandler);
    };
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
    showSpeechBubble,
    onStep,
    supersatiationBonus,
    ingredients,
    gameState,
    keybindings,
    recipeMenuCursor,
  ]);

  // Minimap
  const minimapMobs = useMemo(
    () => [
      ...initialMobs.map((m, i) => ({
        x: mobPositions[i].x,
        z: mobPositions[i].z,
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
          debugPath: a.debugPath ?? [],
        })),
      ...xpDrops.map((drop) => ({
        x: drop.x,
        z: drop.z,
        name: `+${drop.amount} XP`,
        amount: drop.amount,
        cssColor: "#fd0",
        isAdventurer: false,
        isXp: true,
        isIngredient: false,
      })),
      ...ingredientDrops.map((drop) => ({
        x: drop.x,
        z: drop.z,
        name: drop.name,
        cssColor: "#0df",
        isAdventurer: false,
        isXp: false,
        isIngredient: true,
      })),
      ...chests.map((c) => ({
        x: c.x,
        z: c.z,
        name: `Chest (${c.value} loot)`,
        cssColor: "#b8860b",
        isAdventurer: false,
        isXp: false,
        isIngredient: false,
        isChest: true,
      })),
    ],
    [
      initialMobs,
      mobPositions,
      mobStatuses,
      mobSatiations,
      adventurers,
      xpDrops,
      ingredientDrops,
      chests,
    ],
  );

  const { minimapRef, minimapTooltip, setMinimapTooltip, onMinimapMouseMove } =
    useMinimapData(minimapMobs, dungeonWidth, dungeonHeight);

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
          fontFamily: "'Metamorphous', serif",
        }}
      >
        <GameHeader
          dungeonSeed={dungeonSeed}
          currentWave={currentWave}
          onSettingsClick={() => setShowSettings(true)}
          onRandomizeSeed={() =>
            setDungeonSeed(Math.floor(Math.random() * 0xffffff))
          }
        />

        {/* Main area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 3D view */}
          <div style={{ flex: 1, position: "relative", outline: "1px solid #1a1816" }}>
            {/* Inset bevel overlay — sits above the WebGL canvas */}
            <div style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 10,
              boxShadow:
                "inset 0 6px 0 0 #1a1816, inset 6px 0 0 0 #1e1c1a, inset 0 -6px 0 0 #7a7268, inset -6px 0 0 0 #6a6258, inset 0 18px 40px rgba(0,0,0,0.7), inset 0 -6px 12px rgba(255,255,255,0.03)",
            }} />
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
                objectOccupiedKeys={doorOccupiedKeys}
                mobiles={mobiles}
                spriteAtlas={characterSpriteAtlas}
                adventurerSpriteAtlas={characterSpriteAtlas}
                passageMask={passageMask ?? undefined}
                passageOverlayIds={PASSAGE_OVERLAY_IDS}
                speechBubbles={activeSpeechBubbles}
                torchColor={torchColor}
                torchIntensity={torchIntensity}
                floorData={floorData}
                wallData={wallData}
                ceilingData={ceilingData}
                floorTileMap={FLOOR_TILE_MAP}
                wallTileMap={WALL_TILE_MAP}
                ceilingTileMap={CEILING_TILE_MAP}
                style={{ width: "100%", height: "100%" }}
              />
            )}

            <WaveCountdown
              turnsLeft={waveCountdown}
              visible={
                waveCountdown <= WAVE_COUNTDOWN_THRESHOLD &&
                adventurers.filter((a) => a.alive).length === 0
              }
            />

            {/* Interaction prompt */}
            {promptText && !showRecipeMenu && (
              <div
                style={{
                  position: "absolute",
                  bottom: 70,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#2e2c29",
                  outline: "1px solid #1e1c1a",
                  boxShadow: "inset 0 2px 0 0 #5a5450, inset 2px 0 0 0 #504a46, inset 0 -2px 0 0 #1a1816, inset -2px 0 0 0 #1e1c1a, inset 0 4px 12px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.8)",
                  backgroundImage: "repeating-conic-gradient(rgba(0,0,0,0.03) 0% 25%, transparent 0% 50%)",
                  backgroundSize: "4px 4px",
                  padding: "6px 14px",
                  fontSize: 13,
                  color: "#c8a060",
                  fontFamily: '"Metamorphous", serif',
                  letterSpacing: "0.05em",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {promptText}
              </div>
            )}

            {showRecipeMenu && (
              <RecipeMenu
                recipes={RECIPES}
                ingredients={ingredients}
                showMsg={showMsg}
                selectedIndex={recipeMenuCursor}
                keybindings={keybindings}
                onSelectRecipe={(recipe) => {
                  if (recipe.ingredientId) {
                    const newIng = {
                      ...ingredientsRef.current,
                      [recipe.ingredientId]:
                        ingredientsRef.current[recipe.ingredientId] - 1,
                    };
                    ingredientsRef.current = newIng;
                    setIngredients(newIng);
                  }
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
                onCancel={() => setShowRecipeMenu(false)}
              />
            )}

            {/* Message */}
            {message && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#2e2c29",
                  outline: "1px solid #1e1c1a",
                  boxShadow: "inset 0 2px 0 0 #5a5450, inset 2px 0 0 0 #504a46, inset 0 -2px 0 0 #1a1816, inset -2px 0 0 0 #1e1c1a, inset 0 4px 12px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.8)",
                  backgroundImage: "repeating-conic-gradient(rgba(0,0,0,0.03) 0% 25%, transparent 0% 50%)",
                  backgroundSize: "4px 4px",
                  padding: "8px 18px",
                  fontSize: 13,
                  color: "#c8a060",
                  fontFamily: '"Metamorphous", serif',
                  letterSpacing: "0.04em",
                  maxWidth: 480,
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                {message}
              </div>
            )}
          </div>

          <MinimapSidebar
            minimapRef={minimapRef}
            minimapMobs={minimapMobs}
            minimapTooltip={minimapTooltip}
            setMinimapTooltip={setMinimapTooltip}
            onMinimapMouseMove={onMinimapMouseMove}
            solidData={solidData}
            temperatureData={dynamicTempData}
            showTempTint={showTempTint}
            setShowTempTint={setShowTempTint}
            dungeonWidth={dungeonWidth}
            dungeonHeight={dungeonHeight}
            camera={camera}
            passagesRef={passagesRef}
            exploredMaskRef={exploredMaskRef}
          />
        </div>

        <DifficultyModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          settingsProps={{
            tempDropPerStep,
            setTempDropPerStep,
            heatingPerStep,
            setHeatingPerStep,
            satiationDropPerStep,
            turnsPerWave,
            setTurnsPerWave,
            setSatiationDropPerStep,
            supersatiationBonus,
            setSupersatiationBonus,
            traversalFactor,
            setTraversalFactor,
            dungeonSeed,
            setDungeonSeed,
            dungeonWidth,
            setDungeonWidth,
            dungeonHeight,
            setDungeonHeight,
            minLeafSize,
            setMinLeafSize,
            maxLeafSize,
            setMaxLeafSize,
            minRoomSize,
            setMinRoomSize,
            maxRoomSize,
            setMaxRoomSize,
            adventurerDreadRate,
            setAdventurerDreadRate,
            adventurerLootPerChest,
            setAdventurerLootPerChest,
            maxDoors,
            setMaxDoors,
            torchColor,
            setTorchColor,
            torchIntensity,
            setTorchIntensity,
            keybindings,
            setKeybindings,
          }}
        />

        <StatusBar
          camera={camera}
          facing={cardinalDir(camera.yaw)}
          playerHp={playerHp}
          playerMaxHp={PLAYER_MAX_HP}
          playerXp={playerXp}
          ingredients={ingredients}
          currentRoomTemp={(() => {
            const gx = Math.floor(camera.x);
            const gz = Math.floor(camera.z);
            const regionId = regionIdData[gz * dungeonWidth + gx];
            return Math.min(
              255,
              127 + Math.round(roomTempRise.get(regionId) ?? 0),
            );
          })()}
        />
      </div>

      <HandsHUD hands={playerHands} />

      <GameOverOverlay
        gameState={gameState}
        gameOverReason={gameOverReason}
        currentWave={currentWave}
        turnCount={turnCount}
        winWaves={WIN_WAVES}
        onPlayAgain={() => {
          // Reset by bumping dungeon seed, which triggers the reset effect
          setDungeonSeed((s) => s);
          const freshSatiations = initialMobs.map(() => 40);
          setPlayerHands({ left: null, right: null });
          setMobSatiations(freshSatiations);
          setRoomTempRise(new Map());
          setStoveStates(new Map());
          setShowRecipeMenu(false);
          setActiveStoveKey(null);
          setMessage(null);
          setAdventurers([]);
          setCurrentWave(0);
          setTurnCount(0);
          setWaveCountdown(turnsPerWave);
          setPlayerXp(0);
          setXpDrops([]);
          setPlayerHp(PLAYER_MAX_HP);
          setIngredients({ rations: 0, herbs: 0, dust: 0 });
          setIngredientDrops([...initialIngredientDrops]);
          setChests([...initialChests]);
          chestsRef.current = [...initialChests];
          setGameState("playing");
          setGameOverReason(null);
          adventurersRef.current = [];
          currentWaveRef.current = 0;
          turnCountRef.current = 0;
          waveCountdownRef.current = turnsPerWave;
          playerXpRef.current = 0;
          xpDropsRef.current = [];
          playerHpRef.current = PLAYER_MAX_HP;
          ingredientsRef.current = { rations: 0, herbs: 0, dust: 0 };
          ingredientDropsRef.current = [...initialIngredientDrops];
          mobSatiationsRef.current = freshSatiations;
          const freshPositions = initialMobs.map((m) => ({ x: m.x, z: m.z }));
          setMobPositions(freshPositions);
          mobPositionsRef.current = freshPositions;
          ruinedNotifiedRef.current = new Set();
        }}
      />
    </>
  );
}
