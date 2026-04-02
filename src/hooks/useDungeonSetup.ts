import { useMemo } from "react";
import { generateBspDungeon } from "../../roguelike-mazetools/src/bsp";
import { generateThemedRooms } from "../../roguelike-mazetools/src/content";
import { THEMES, THEME_KEYS } from "../themes";
import {
  atlasIndex,
  CEILING_H,
  TILE_SIZE,
  COBBLESTONE_WALL_ID,
  MOB_ATTACK,
  MOB_DEFENSE,
  MOB_HP,
  MOB_NAMES,
  MOB_TYPES,
} from "../gameConstants";
import { makeRng } from "../gameUtils";
import { RECIPES } from "../tea";

export interface DungeonSetupSettings {
  dungeonSeed: number;
  dungeonWidth: number;
  dungeonHeight: number;
  minLeafSize: number;
  maxLeafSize: number;
  minRoomSize: number;
  maxRoomSize: number;
  maxDoors: number;
  trapDensity: number;
}

export function useDungeonSetup({
  dungeonSeed,
  dungeonWidth,
  dungeonHeight,
  minLeafSize,
  maxLeafSize,
  minRoomSize,
  maxRoomSize,
  maxDoors,
  trapDensity,
}: DungeonSetupSettings) {
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

  const { spawnX, spawnZ, spawnYaw } = useMemo(() => {
    const room = dungeon.rooms.get(dungeon.endRoomId);
    if (!room) return { spawnX: 1.5, spawnZ: 1.5, spawnYaw: 0 };
    return {
      spawnX: (room as any).rect.x + Math.floor((room as any).rect.w / 2) + 0.5,
      spawnZ: (room as any).rect.y + Math.floor((room as any).rect.h / 2) + 1.5, // one cell south of stove
      spawnYaw: 0, // face north toward the stove
    };
  }, [dungeon]);

  // Assign floor/wall/ceiling types to every room and corridor by theme
  useMemo(() => {
    const floorDataArr = dungeon.textures.floorType.image.data;
    const wallDataArr = dungeon.textures.wallType.image.data;
    const ceilingDataArr = dungeon.textures.ceilingType.image.data;
    const solidDataArr = dungeon.textures.solid.image.data;
    const rng = makeRng(dungeon.seed);
    const themes: Record<any, any> = {};
    for (const [roomId, room] of dungeon.rooms) {
      console.log("room", room);
      let floorId: number, wallId: number, ceilingId: number;
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
        const theme = (THEMES as any)[key];
        floorId = atlasIndex.floorTypes.idByName(theme.floorType);
        wallId = atlasIndex.wallTypes.idByName(theme.wallType);
        ceilingId = atlasIndex.ceilingTypes.idByName(theme.ceilingType);
      }
      themes[roomId as number] = (
        x: number,
        y: number,
        ctx: { width: number },
      ) => {
        const i = y * ctx.width + x;
        if (solidDataArr[i] === 0) {
          floorDataArr[i] = floorId;
          ceilingDataArr[i] = ceilingId;
        } else {
          wallDataArr[i] = wallId;
        }
      };
    }
    generateThemedRooms(dungeon, themes);
    dungeon.textures.floorType.needsUpdate = true;
    dungeon.textures.wallType.needsUpdate = true;
    dungeon.textures.ceilingType.needsUpdate = true;
  }, [dungeon]);

  // Stove placements — 1 stove in end room at centre
  const stovePlacements = useMemo(() => {
    const room = dungeon.rooms.get(dungeon.endRoomId);
    if (!room) return [];
    const cx = (room as any).rect.x + Math.floor((room as any).rect.w / 2);
    const cz = (room as any).rect.y + Math.floor((room as any).rect.h / 2);
    return [{ x: cx, z: cz, type: "stove" }];
  }, [dungeon]);

  // Door placements
  const doorPlacements = useMemo(() => {
    const W = dungeon.width;
    const H = dungeon.height;
    const solidArr = dungeon.textures.solid.image.data;
    const regionArr = dungeon.textures.regionId.image.data;
    const wallDataArr = dungeon.textures.wallType.image.data;

    function isCorridor(x: number, z: number): boolean {
      if (x < 0 || z < 0 || x >= W || z >= H) return false;
      return solidArr[z * W + x] === 0 && regionArr[z * W + x] === 0;
    }
    function isRoom(x: number, z: number): boolean {
      if (x < 0 || z < 0 || x >= W || z >= H) return false;
      return solidArr[z * W + x] === 0 && regionArr[z * W + x] !== 0;
    }

    // Find all threshold cells: corridor cells directly adjacent to a room cell
    const groups = new Map<
      string,
      { x: number; z: number; dx: number; dz: number }[]
    >();
    const DIRS4: [number, number][] = [
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
            groups.get(key)!.push({ x, z, dx, dz });
            break;
          }
        }
      }
    }

    // Collect all candidate door positions without mutating solidArr yet
    const candidates: any[] = [];
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
    const selected = new Set(
      candidates.slice(0, maxDoors).map((_: any, i: number) => i),
    );

    const placements: any[] = [];
    candidates.forEach((c: any, i: number) => {
      if (selected.has(i)) {
        c.cells.forEach((cell: any, j: number) => {
          if (j !== c.midIdx) {
            // Wall off non-door threshold cells; use the room's wall type
            solidArr[cell.z * W + cell.x] = 255;
            wallDataArr[cell.z * W + cell.x] = c.roomWallId;
          }
        });

        // Wall off perpendicular flanking corridor cells to prevent floating doors.
        // For a door at (x, z) facing (dx, dz), flanking cells are at (x±dz, z∓dx).
        const { x: doorX, z: doorZ } = c.placement;
        const bdx: number = c.placement.meta.blockDx;
        const bdz: number = c.placement.meta.blockDz;
        for (const [fx, fz] of [
          [doorX - bdz, doorZ + bdx],
          [doorX + bdz, doorZ - bdx],
        ]) {
          if (fx >= 0 && fx < W && fz >= 0 && fz < H) {
            const fi = fz * W + fx;
            if (solidArr[fi] === 0 && regionArr[fz * W + fx] === 0) {
              solidArr[fi] = 255;
              wallDataArr[fi] = c.roomWallId;
            }
          }
        }

        placements.push(c.placement);
      }
      // else: leave corridor open with no door
    });

    dungeon.textures.solid.needsUpdate = true;
    dungeon.textures.wallType.needsUpdate = true;
    return placements;
  }, [dungeon, maxDoors]);

  // Spike trap placement — within Manhattan distance 2 of any door cell
  const hazardData = useMemo(() => {
    const hazArr = dungeon.textures.hazards.image.data as Uint8Array;
    hazArr.fill(0);

    if (trapDensity <= 0 || doorPlacements.length === 0) {
      dungeon.textures.hazards.needsUpdate = true;
      return hazArr;
    }

    const W = dungeon.width;
    const H = dungeon.height;
    const solidArr = dungeon.textures.solid.image.data;
    const rng = makeRng(dungeonSeed ^ 0xf00dbabe);
    const chance = Math.min(1.0, trapDensity * 0.4);

    // Exclude the exact door cells from trap placement
    const doorCellKeys = new Set(doorPlacements.map((d: any) => d.z * W + d.x));

    // Collect eligible cells: walkable, within Manhattan distance 2 of a door, not a door cell itself
    const eligible = new Set<number>();
    for (const door of doorPlacements) {
      const { x: doorX, z: doorZ } = door;
      for (let rowDiff = -2; rowDiff <= 2; rowDiff++) {
        const colRange = 2 - Math.abs(rowDiff);
        for (let colDiff = -colRange; colDiff <= colRange; colDiff++) {
          const cx = doorX + colDiff;
          const cz = doorZ + rowDiff;
          if (cx < 0 || cz < 0 || cx >= W || cz >= H) continue;
          const idx = cz * W + cx;
          if (solidArr[idx] !== 0) continue;
          if (doorCellKeys.has(idx)) continue;
          eligible.add(idx);
        }
      }
    }

    for (const idx of eligible) {
      if (rng() < chance) {
        hazArr[idx] = 1;
      }
    }

    dungeon.textures.hazards.needsUpdate = true;
    return hazArr;
  }, [dungeon, dungeonSeed, doorPlacements, trapDensity]);

  // Object registry and world placements
  const objects = useMemo(() => {
    return [
      ...stovePlacements.map((s) => ({
        ...s,
        offsetY: (TILE_SIZE * 0.65) / 2,
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
    const mobs: any[] = [];
    let idx = 0;
    for (const [roomId, room] of dungeon.rooms) {
      console.log(
        roomId,
        "type:",
        (room as any).type,
        "isEnd:",
        roomId === dungeon.endRoomId,
        "idx:",
        idx,
      );
      if (roomId === dungeon.endRoomId || idx >= MOB_NAMES.length) continue;
      mobs.push({
        id: `mob_${idx}`,
        x: Math.floor((room as any).rect.x + (room as any).rect.w / 2),
        z: Math.floor((room as any).rect.y + (room as any).rect.h / 2),
        name: MOB_NAMES[idx],
        type: MOB_TYPES[idx].type,
        preferredRecipeId: RECIPES[(idx * 3 + 1) % RECIPES.length].id,
        attack: MOB_ATTACK,
        defense: MOB_DEFENSE,
        hp: MOB_HP,
      });
      idx++;
    }
    return mobs;
  }, [dungeon]);

  // Rooms sorted farthest-first from player spawn — used for adventurer spawning
  const adventurerSpawnRooms = useMemo(() => {
    const endRoom = dungeon.rooms.get(dungeon.endRoomId);
    const endCx = endRoom
      ? (endRoom as any).rect.x + (endRoom as any).rect.w / 2
      : 0;
    const endCz = endRoom
      ? (endRoom as any).rect.y + (endRoom as any).rect.h / 2
      : 0;
    return Array.from(dungeon.rooms.entries())
      .filter(([id]) => id !== dungeon.endRoomId)
      .map(([, room]) => ({
        x: Math.floor((room as any).rect.x + (room as any).rect.w / 2),
        z: Math.floor((room as any).rect.y + (room as any).rect.h / 2),
        dist: Math.hypot(
          (room as any).rect.x + (room as any).rect.w / 2 - endCx,
          (room as any).rect.y + (room as any).rect.h / 2 - endCz,
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
      .map(([, room]) => room as any);
    if (!nonEndRooms.length) return [];

    const drops: any[] = [];
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
      (r) => (r as any).id !== dungeon.endRoomId,
    ) as any[];
    const chests: any[] = [];
    const usedRooms = new Set<any>();
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

  return {
    dungeon,
    solidData,
    floorData,
    wallData,
    ceilingData,
    temperatureData,
    spawnX,
    spawnZ,
    spawnYaw,
    stovePlacements,
    doorPlacements,
    hazardData,
    objects,
    initialMobs,
    adventurerSpawnRooms,
    initialIngredientDrops,
    initialChests,
  };
}
