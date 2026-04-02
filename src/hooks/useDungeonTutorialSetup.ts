import { useMemo } from "react";
import * as THREE from "three";
import type { BspDungeonOutputs, RoomInfo } from "../../roguelike-mazetools/src/bsp";
import { atlasIndex, CEILING_H } from "../gameConstants";
import { LESSON_CONFIGS } from "../tutorial/lessons";

// ── Texture helpers (mirrors bsp.ts internal helpers) ──────────────────────

function makeR8Tex(
  data: Uint8Array,
  w: number,
  h: number,
  name: string,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    data,
    w,
    h,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  tex.name = name;
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  return tex;
}

function makeRGBATex(
  data: Uint8Array,
  w: number,
  h: number,
  name: string,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    data,
    w,
    h,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.name = name;
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  return tex;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDungeonTutorialSetup(lessonIndex: number) {
  const config = LESSON_CONFIGS[lessonIndex];

  const dungeon = useMemo((): BspDungeonOutputs => {
    const W = config.dungeonW;
    const H = config.dungeonH;
    const size = W * H;

    const solidArr = new Uint8Array(size).fill(255); // all walls
    const regionIdArr = new Uint8Array(size); // 0 = no region
    const floorArr = new Uint8Array(size);
    const wallArr = new Uint8Array(size);
    const ceilArr = new Uint8Array(size);
    const tempArr = new Uint8Array(size); // 0 for walls, 127 for floors

    const floorId = atlasIndex.floorTypes.idByName("Flagstone") || 1;
    const wallId = atlasIndex.wallTypes.idByName("Plaster") || 1;
    const ceilId = atlasIndex.ceilingTypes.idByName("Flagstone") || 1;

    // Pre-fill all cells as walls
    wallArr.fill(wallId);

    const rooms = new Map<number, RoomInfo>();

    config.rooms.forEach((room, idx) => {
      const roomId = idx + 1;
      for (let z = room.y; z < room.y + room.h; z++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          const i = z * W + x;
          solidArr[i] = 0;
          regionIdArr[i] = roomId;
          floorArr[i] = floorId;
          wallArr[i] = 0; // floor cells have no wall texture
          ceilArr[i] = ceilId;
          tempArr[i] = 127;
        }
      }
      rooms.set(roomId, {
        id: roomId,
        type: "room",
        rect: { x: room.x, y: room.y, w: room.w, h: room.h },
        connections: [],
      });
    });

    return {
      width: W,
      height: H,
      seed: 0x7e70 + lessonIndex,
      rooms,
      startRoomId: config.startRoomId,
      endRoomId: config.endRoomId,
      fullRegionIds: regionIdArr,
      firstCorridorRegionId: config.rooms.length + 1,
      textures: {
        solid: makeR8Tex(solidArr, W, H, "tut_solid"),
        regionId: makeR8Tex(regionIdArr, W, H, "tut_regionId"),
        floorType: makeR8Tex(floorArr, W, H, "tut_floor"),
        wallType: makeR8Tex(wallArr, W, H, "tut_wall"),
        ceilingType: makeR8Tex(ceilArr, W, H, "tut_ceiling"),
        temperature: makeR8Tex(tempArr, W, H, "tut_temp"),
        distanceToWall: makeR8Tex(new Uint8Array(size), W, H, "tut_dtw"),
        hazards: makeR8Tex(new Uint8Array(size), W, H, "tut_hazards"),
        overlays: makeRGBATex(new Uint8Array(size * 4), W, H, "tut_overlays"),
        wallOverlays: makeRGBATex(
          new Uint8Array(size * 4),
          W,
          H,
          "tut_wallOverlays",
        ),
        ceilingOverlays: makeRGBATex(
          new Uint8Array(size * 4),
          W,
          H,
          "tut_ceilOverlays",
        ),
      },
    };
  }, [lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const solidData = useMemo(
    () => dungeon.textures.solid.image.data as Uint8Array,
    [dungeon],
  );
  const floorData = useMemo(
    () => dungeon.textures.floorType.image.data as Uint8Array,
    [dungeon],
  );
  const wallData = useMemo(
    () => dungeon.textures.wallType.image.data as Uint8Array,
    [dungeon],
  );
  const ceilingData = useMemo(
    () => dungeon.textures.ceilingType.image.data as Uint8Array,
    [dungeon],
  );
  const temperatureData = useMemo(
    () => dungeon.textures.temperature.image.data as Uint8Array,
    [dungeon],
  );

  const stovePlacements = useMemo(
    () => config.stovePlacements,
    [lessonIndex], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const objects = useMemo(
    () => stovePlacements.map((s) => ({ ...s, offsetY: (CEILING_H * 0.85) / 2 })),
    [stovePlacements],
  );

  const initialMobs = useMemo(
    () => config.mobs,
    [lessonIndex], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    dungeon,
    solidData,
    floorData,
    wallData,
    ceilingData,
    temperatureData,
    spawnX: config.spawnX,
    spawnZ: config.spawnZ,
    spawnYaw: config.spawnYaw,
    stovePlacements,
    doorPlacements: [] as any[],
    objects,
    initialMobs,
    adventurerSpawnRooms: [] as { x: number; z: number; dist: number }[],
    initialIngredientDrops: [] as any[],
    initialChests: [] as any[],
  };
}
