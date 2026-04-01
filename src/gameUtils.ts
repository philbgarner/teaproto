import * as THREE from "three";
import {
  TORCH_OBJECT_VERT,
  TORCH_OBJECT_FRAG,
  makeTorchUniforms,
} from "../roguelike-mazetools/src/rendering/torchLighting";
import {
  TILE_PX,
  ATLAS_SHEET_W,
  ATLAS_SHEET_H,
  TILE_SIZE,
  CEILING_H,
  atlasIndex,
} from "./gameConstants";
import { BspDungeonOutputs, RoomInfo } from "../roguelike-mazetools/src/bsp";
import { AtlasSpriteEntry } from "../roguelike-mazetools/src/atlas";

/**
 * Convert a pixel-space UV rect {x, y, w, h} into the normalized [x, y, w, h]
 * tuple expected by the billboard shader (y=0 is bottom in GL convention).
 */
export function normalizeUvRect(
  rect: { x: number; y: number; w: number; h: number } | undefined | null,
  sheetW: number,
  sheetH: number,
): [number, number, number, number] | undefined {
  if (!rect) return undefined;
  return [
    rect.x / sheetW,
    1.0 - (rect.y + rect.h) / sheetH,
    rect.w / sheetW,
    rect.h / sheetH,
  ];
}

/**
 * Builds the initial explored mask for a new dungeon.
 * Pre-explores the kitchen (startRoomId), the first monster's room, and the
 * corridor path connecting them.
 */
export function buildInitialExploredMask(
  dungeon: BspDungeonOutputs,
  width: number,
  height: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const { rooms, endRoomId, fullRegionIds } = dungeon;

  function markRegion(regionId: number) {
    for (let i = 0; i < fullRegionIds.length; i++) {
      if (fullRegionIds[i] === regionId) mask[i] = 1;
    }
  }

  // Kitchen = endRoomId
  markRegion(endRoomId);

  // First monster room = first room (not endRoomId) in insertion order
  let firstMobRoomId: number | null = null;
  for (const [roomId, room] of rooms) {
    if (roomId !== endRoomId && (room as RoomInfo).type === "room") {
      firstMobRoomId = roomId;
      break;
    }
  }

  if (firstMobRoomId !== null) {
    markRegion(firstMobRoomId);

    // Map each room ID to the corridor IDs that border it
    const roomToCorridors = new Map<number, number[]>();
    for (const [id, room] of rooms) {
      if ((room as RoomInfo).type !== "corridor") continue;
      for (const connRoomId of (room as RoomInfo).connections) {
        if (!roomToCorridors.has(connRoomId))
          roomToCorridors.set(connRoomId, []);
        roomToCorridors.get(connRoomId)!.push(id);
      }
    }

    // BFS from endRoomId to firstMobRoomId; mark corridors on path
    const visited = new Set<number>([endRoomId]);
    const queue: [number, number[]][] = [[endRoomId, []]]; // [roomId, corridorPath]

    outer: while (queue.length > 0) {
      const [curRoom, corridorPath] = queue.shift()!;
      for (const corridorId of roomToCorridors.get(curRoom) ?? []) {
        const corridor = rooms.get(corridorId) as RoomInfo | undefined;
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

export function cardinalDir(yaw: number): string {
  const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const norm = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const idx = Math.round((norm / (Math.PI * 2)) * 8) % 8;
  return DIRS[idx];
}

// Bresenham line-of-sight: returns true if ax,az can see bx,bz with no walls in between.
// Checks all intermediate cells (not endpoints) for walkability.
export function hasLineOfSight(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  walkableFn: (x: number, z: number) => boolean,
): boolean {
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
// Seeded LCG RNG (Numerical Recipes constants)
// ---------------------------------------------------------------------------
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function loadAtlasTexture(): Promise<THREE.Texture> {
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
export function makeDoorProto(
  atlasTex: THREE.Texture,
  archUvX: number,
  archUvY: number,
): THREE.Mesh {
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
export function makeTeaomaticProto(atlasTex: THREE.Texture): THREE.Mesh {
  const uvEntry = atlasIndex.sprites.byName("teaomatic") as AtlasSpriteEntry;
  const [uvX, uvY] = uvEntry.uv;
  const [uvW, uvH] = uvEntry.size ?? [TILE_PX, TILE_PX];
  const uMin = uvX / ATLAS_SHEET_W;
  const uMax = (uvX + uvW) / ATLAS_SHEET_W;
  const vMin = 1 - (uvY + uvH) / ATLAS_SHEET_H;
  const vMax = 1 - uvY / ATLAS_SHEET_H;

  const bW = TILE_SIZE * 0.65;
  const bH = TILE_SIZE * 0.65;
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
