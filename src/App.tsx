import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useLoader, useFrame } from "@react-three/fiber";
import { useSettings } from "./SettingsContext";
import { useDungeonSetup } from "./hooks/useDungeonSetup";
import { useGameState } from "./hooks/useGameState";
import { useEotBCamera } from "./hooks/useEotBCamera";
import { PerspectiveDungeonView } from "../roguelike-mazetools/src/rendering/PerspectiveDungeonView";
import {
  TORCH_UNIFORMS_GLSL,
  TORCH_HASH_GLSL,
  TORCH_FNS_GLSL,
  makeTorchUniforms,
} from "../roguelike-mazetools/src/rendering/torchLighting";
import {
  InstancedTileMesh,
  type TileInstance,
} from "../roguelike-mazetools/src/rendering/InstancedTileMesh";
import type { TileAtlas } from "../roguelike-mazetools/src/rendering/tileAtlas";
import { StatusBar } from "./components/StatusBar";
import { WaveCountdown } from "./components/WaveCountdown";
import { RecipeMenu } from "./components/RecipeMenu";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { MinimapSidebar } from "./components/MinimapSidebar";
import { DifficultyModal } from "./components/DifficultyModal";
import { RECIPES } from "./tea";
import {
  TILE_FLOOR,
  TILE_CEILING,
  TILE_WALL,
  TILE_DIRT,
  CEILING_H,
  TILE_SIZE,
  FLOOR_TILE_MAP,
  WALL_TILE_MAP,
  CEILING_TILE_MAP,
  PASSAGE_OVERLAY_IDS,
  TRAP_GRID_OVERLAY_ID,
  SPIKE_TRAP_OVERLAY_ID,
  PLAYER_MAX_HP,
  WAVE_COUNTDOWN_THRESHOLD,
  WIN_WAVES,
} from "./gameConstants";
import { cardinalDir } from "./gameUtils";
import "./App.css";

// ---------------------------------------------------------------------------
// Spike trap 3D mesh — rendered inside the Canvas as children of PerspectiveDungeonView
// ---------------------------------------------------------------------------

const _spikeQ = new THREE.Quaternion();
const _spikeV = new THREE.Vector3();
const _spikeS = new THREE.Vector3();

function buildSpikeMatrix(
  px: number,
  py: number,
  pz: number,
  ry: number,
  scaleY: number,
  scaleX: number,
): THREE.Matrix4 {
  _spikeQ.setFromEuler(new THREE.Euler(0, ry, 0, "YXZ"));
  const m = new THREE.Matrix4();
  m.compose(_spikeV.set(px, py, pz), _spikeQ, _spikeS.set(scaleX, scaleY, 1));
  return m;
}

function SpikeTrapMeshes({
  disarmedTraps,
  hazardData,
  dungeonWidth,
  atlas,
  texture,
  tileSize,
  ceilingHeight,
  fogNear,
  fogFar,
  torchColor,
  torchIntensity,
}: {
  disarmedTraps: Set<string>;
  hazardData: Uint8Array;
  dungeonWidth: number;
  atlas: TileAtlas;
  texture: THREE.Texture;
  tileSize: number;
  ceilingHeight: number;
  fogNear?: number;
  fogFar?: number;
  torchColor?: string;
  torchIntensity?: number;
}) {
  const torchColorObj = useMemo(
    () => (torchColor ? new THREE.Color(torchColor) : undefined),
    [torchColor],
  );

  const instances = useMemo<TileInstance[]>(() => {
    const result: TileInstance[] = [];
    const spikeH = ceilingHeight / 3;
    const spacing = tileSize / 3;
    const HALF_PI = Math.PI / 2;

    for (const key of disarmedTraps) {
      const [xs, zs] = key.split("_");
      const cx = parseInt(xs, 10);
      const cz = parseInt(zs, 10);
      if (hazardData[cz * dungeonWidth + cx] !== 1) continue;

      const wx = (cx + 0.5) * tileSize;
      const wz = (cz + 0.5) * tileSize;
      const py = spikeH / 2;

      // Group A: 3 fins running along Z, offset along X, rotated 90° around Y
      for (const dx of [-spacing, 0, spacing]) {
        result.push({
          matrix: buildSpikeMatrix(wx + dx, py, wz, HALF_PI, spikeH, tileSize),
          tileId: SPIKE_TRAP_OVERLAY_ID,
        });
      }
      // Group B: 3 fins running along X, offset along Z, no Y rotation
      for (const dz of [-spacing, 0, spacing]) {
        result.push({
          matrix: buildSpikeMatrix(wx, py, wz + dz, 0, spikeH, tileSize),
          tileId: SPIKE_TRAP_OVERLAY_ID,
        });
      }
    }
    return result;
  }, [disarmedTraps, hazardData, dungeonWidth, tileSize, ceilingHeight]);

  if (instances.length === 0) return null;

  return (
    <InstancedTileMesh
      instances={instances}
      atlas={atlas}
      texture={texture}
      fogNear={fogNear}
      fogFar={fogFar}
      torchColor={torchColorObj}
      torchIntensity={torchIntensity}
      doubleSide
    />
  );
}

// ---------------------------------------------------------------------------
// Coin drop 3D mesh — billboarded sprites using icons.png with torch lighting
// ---------------------------------------------------------------------------

// icons.png is 256×256 with 32-pixel tile grid.
// coins1 sprite is at pixel origin (32, 128).
const _ICONS_W = 256;
const _ICONS_H = 256;
const _ICON_PX = 32;
const COIN_UV_RECT = new THREE.Vector4(
  32 / _ICONS_W,
  1 - (128 + _ICON_PX) / _ICONS_H, // WebGL: y=0 is bottom
  _ICON_PX / _ICONS_W,
  _ICON_PX / _ICONS_H,
);

const COIN_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFogDist;
varying vec2 vWorldPos;
void main() {
  vUv = uv;
  float bob = sin(uTime * 2.5) * 0.06;
  vec4 worldPos = modelMatrix * vec4(position.x, position.y + bob, position.z, 1.0);
  vWorldPos = worldPos.xz;
  vec4 eyePos = viewMatrix * worldPos;
  vFogDist = length(eyePos.xyz);
  gl_Position = projectionMatrix * eyePos;
}
`;

const COIN_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec4 uUvRect;
uniform vec3 uFogColor;
${TORCH_UNIFORMS_GLSL}
varying vec2 vUv;
varying float vFogDist;
varying vec2 vWorldPos;
${TORCH_HASH_GLSL}
${TORCH_FNS_GLSL}
void main() {
  vec4 color = texture2D(uAtlas, uUvRect.xy + vUv * uUvRect.zw);
  if (color.a < 0.5) discard;
  float band = torchBand(0.03);
  vec3 lit = applyTorchLighting(color.rgb, band);
  float shinePhase = fract(uTime * 0.4);
  float shine = smoothstep(0.08, 0.0, abs(vUv.x - shinePhase)) * 0.7;
  lit += color.rgb * shine * vec3(1.0, 0.95, 0.7);
  gl_FragColor = vec4(mix(lit, uFogColor, step(4.0, band)), color.a);
}
`;

const COIN_GEO = new THREE.PlaneGeometry(1, 1);

// ---------------------------------------------------------------------------
// Chest billboard — same sheet as character sprites (monsters.png 512×512)
// Chest sprite is at pixel (384, 0), size 64×64.
// No bobbing; white shine.
// ---------------------------------------------------------------------------

const _CHAR_W = 512;
const _CHAR_H = 512;
const CHEST_UV_RECT = new THREE.Vector4(
  384 / _CHAR_W,
  1 - 64 / _CHAR_H, // WebGL: y=0 is bottom; top row → bottom = 1 - 64/512
  64 / _CHAR_W,
  64 / _CHAR_H,
);
const MIMIC_UV_RECT = new THREE.Vector4(
  448 / _CHAR_W,
  1 - 64 / _CHAR_H,
  64 / _CHAR_W,
  64 / _CHAR_H,
);

const CHEST_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vFogDist;
varying vec2 vWorldPos;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xz;
  vec4 eyePos = viewMatrix * worldPos;
  vFogDist = length(eyePos.xyz);
  gl_Position = projectionMatrix * eyePos;
}
`;

const CHEST_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec4 uUvRect;
uniform vec3 uFogColor;
${TORCH_UNIFORMS_GLSL}
varying vec2 vUv;
varying float vFogDist;
varying vec2 vWorldPos;
${TORCH_HASH_GLSL}
${TORCH_FNS_GLSL}
void main() {
  vec4 color = texture2D(uAtlas, uUvRect.xy + vUv * uUvRect.zw);
  if (color.a < 0.5) discard;
  float band = torchBand(0.03);
  vec3 lit = applyTorchLighting(color.rgb, band);
  float shinePhase = fract(uTime * 0.4);
  float shine = smoothstep(0.08, 0.0, abs(vUv.x - shinePhase)) * 0.7;
  lit += color.rgb * shine * vec3(1.0, 1.0, 1.0);
  gl_FragColor = vec4(mix(lit, uFogColor, step(4.0, band)), color.a);
}
`;

function CoinBillboard({
  drop,
  tileSize,
  mat,
}: {
  drop: { x: number; z: number };
  tileSize: number;
  mat: THREE.ShaderMaterial;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const coinSize = tileSize * 0.5;
  const wx = (drop.x + 0.5) * tileSize;
  const wz = (drop.z + 0.5) * tileSize;

  useFrame(({ camera }) => {
    if (ref.current)
      ref.current.rotation.y = Math.atan2(
        camera.position.x - wx,
        camera.position.z - wz,
      );
  });

  return (
    <mesh
      ref={ref}
      geometry={COIN_GEO}
      material={mat}
      position={[wx, coinSize / 2, wz]}
      scale={[coinSize, coinSize, 1]}
    />
  );
}

function CoinDropMeshes({
  drops,
  tileSize = 1,
  fogNear = 4,
  fogFar = 28,
  torchColor,
  torchIntensity,
}: {
  drops: { id: string; x: number; z: number }[];
  tileSize?: number;
  fogNear?: number;
  fogFar?: number;
  torchColor?: string;
  torchIntensity?: number;
}) {
  const texture = useLoader(
    THREE.TextureLoader,
    `${import.meta.env.BASE_URL}textures/icons.png`,
  );

  const mat = useMemo(() => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: texture },
        uUvRect: { value: COIN_UV_RECT },
        uFogColor: { value: new THREE.Color(0, 0, 0) },
        uFogNear: { value: fogNear },
        uFogFar: { value: fogFar },
        uTime: { value: 0 },
        ...makeTorchUniforms(),
      },
      vertexShader: COIN_VERT,
      fragmentShader: COIN_FRAG,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
  }, [texture, fogNear, fogFar]);

  const torchColorObj = useMemo(
    () => (torchColor ? new THREE.Color(torchColor) : undefined),
    [torchColor],
  );
  useEffect(() => {
    if (torchColorObj) mat.uniforms.uTorchColor.value = torchColorObj;
  }, [torchColorObj, mat]);
  useEffect(() => {
    if (torchIntensity !== undefined)
      mat.uniforms.uTorchIntensity.value = torchIntensity;
  }, [torchIntensity, mat]);

  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <>
      {drops.map((drop) => (
        <CoinBillboard key={drop.id} drop={drop} tileSize={tileSize} mat={mat} />
      ))}
    </>
  );
}

function ChestBillboard({
  chest,
  tileSize,
  mat,
  mimicMat,
}: {
  chest: { x: number; z: number; mimic?: boolean };
  tileSize: number;
  mat: THREE.ShaderMaterial;
  mimicMat: THREE.ShaderMaterial;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const chestSize = tileSize * 0.6;
  const wx = (chest.x + 0.5) * tileSize;
  const wz = (chest.z + 0.5) * tileSize;

  useFrame(({ camera }) => {
    if (ref.current)
      ref.current.rotation.y = Math.atan2(
        camera.position.x - wx,
        camera.position.z - wz,
      );
  });

  return (
    <mesh
      ref={ref}
      geometry={COIN_GEO}
      material={chest.mimic ? mimicMat : mat}
      position={[wx, chestSize / 2, wz]}
      scale={[chestSize, chestSize, 1]}
    />
  );
}

function ChestMeshes({
  chests,
  tileSize = 1,
  fogNear = 4,
  fogFar = 28,
  torchColor,
  torchIntensity,
}: {
  chests: { id: string; x: number; z: number; mimic?: boolean }[];
  tileSize?: number;
  fogNear?: number;
  fogFar?: number;
  torchColor?: string;
  torchIntensity?: number;
}) {
  const texture = useLoader(
    THREE.TextureLoader,
    `${import.meta.env.BASE_URL}textures/monsters.png`,
  );

  const makeMat = (uvRect: THREE.Vector4) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: texture },
        uUvRect: { value: uvRect },
        uFogColor: { value: new THREE.Color(0, 0, 0) },
        uFogNear: { value: fogNear },
        uFogFar: { value: fogFar },
        uTime: { value: 0 },
        ...makeTorchUniforms(),
      },
      vertexShader: CHEST_VERT,
      fragmentShader: CHEST_FRAG,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });

  const mat = useMemo(() => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return makeMat(CHEST_UV_RECT);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, fogNear, fogFar]);

  const mimicMat = useMemo(
    () => makeMat(MIMIC_UV_RECT),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [texture, fogNear, fogFar]);

  const torchColorObj = useMemo(
    () => (torchColor ? new THREE.Color(torchColor) : undefined),
    [torchColor],
  );
  useEffect(() => {
    if (torchColorObj) {
      mat.uniforms.uTorchColor.value = torchColorObj;
      mimicMat.uniforms.uTorchColor.value = torchColorObj;
    }
  }, [torchColorObj, mat, mimicMat]);
  useEffect(() => {
    if (torchIntensity !== undefined) {
      mat.uniforms.uTorchIntensity.value = torchIntensity;
      mimicMat.uniforms.uTorchIntensity.value = torchIntensity;
    }
  }, [torchIntensity, mat, mimicMat]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    mat.uniforms.uTime.value = t;
    mimicMat.uniforms.uTime.value = t;
  });

  return (
    <>
      {chests.map((chest) => (
        <ChestBillboard key={chest.id} chest={chest} tileSize={tileSize} mat={mat} mimicMat={mimicMat} />
      ))}
    </>
  );
}

export default function App() {
  const {
    playerData,
    setPlayerData,
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
    trapDensity,
    keybindings,
    setKeybindings,
  } = useSettings();

  const ds = useDungeonSetup({
    dungeonSeed,
    dungeonWidth,
    dungeonHeight,
    minLeafSize,
    maxLeafSize,
    minRoomSize,
    maxRoomSize,
    maxDoors,
    trapDensity,
  });

  const gs = useGameState({
    dungeon: ds.dungeon,
    solidData: ds.solidData,
    floorData: ds.floorData,
    wallData: ds.wallData,
    ceilingData: ds.ceilingData,
    temperatureData: ds.temperatureData,
    initialMobs: ds.initialMobs,
    adventurerSpawnRooms: ds.adventurerSpawnRooms,
    initialIngredientDrops: ds.initialIngredientDrops,
    initialChests: ds.initialChests,
    spawnX: ds.spawnX,
    spawnZ: ds.spawnZ,
    spawnYaw: ds.spawnYaw,
    stovePlacements: ds.stovePlacements,
    doorPlacements: ds.doorPlacements,
    hazardData: ds.hazardData,
    dungeonSeed,
    dungeonWidth,
    dungeonHeight,
    tempDropPerStep,
    heatingPerStep,
    satiationDropPerStep,
    supersatiationBonus,
    turnsPerWave,
    traversalFactor,
    adventurerDreadRate,
    adventurerLootPerChest,
    keybindings,
  });

  const {
    camera,
    logicalRef: camLogicalRef,
    doMove,
  } = useEotBCamera(
    ds.solidData,
    dungeonWidth,
    dungeonHeight,
    ds.spawnX,
    ds.spawnZ,
    {
      onStep: gs.onStep,
      blocked: gs.showRecipeMenu || gs.gameState !== "playing",
      onBlockedMove: gs.onBlockedMove,
      canPhaseWalls: !gs.leftHandTea && !gs.rightHandTea,
      blockedPositions: [
        ...ds.stovePlacements,
        ...ds.doorPlacements.filter(
          (d: any) => gs.doorStates.get(`${d.x}_${d.z}`) === "locked",
        ),
      ],
      keybindings,
      startYaw: ds.spawnYaw,
    },
  );

  // Sync game state's logical ref with camera's logical ref so onStep can
  // read the current player position.
  gs.logicalRef.current = camLogicalRef.current;

  // Wire doMove for passage traversal.
  gs.doMoveRef.current = doMove;

  // Compute facing target and expose it to game state handlers via ref.
  const facingTarget = gs.getFacingTarget(camLogicalRef);
  gs.facingTargetRef.current = facingTarget;

  // Interaction prompt text
  const promptText = useMemo(() => {
    if (!facingTarget) return null;
    if (facingTarget.type === "trap") {
      const interactKey =
        keybindings.interact[0] === " " ? "space" : keybindings.interact[0];
      return `Spike trap triggered — Press [${interactKey}] to rearm`;
    }
    if (facingTarget.type === "stove") {
      const state = gs.stoveStates.get(facingTarget.stoveKey);
      if (!state?.brewing) return "Teaomatic — Press [space] to brew tea";
      if (state.brewing.ready)
        return `${state.brewing.recipe.name} is ready! — Press [space] to collect`;
      return `Brewing ${state.brewing.recipe.name}: ${state.brewing.stepsRemaining} steps — Press [space] for status`;
    }
    if (facingTarget.type === "door") {
      const interactKey =
        keybindings.interact[0] === " " ? "space" : keybindings.interact[0];
      const state = gs.doorStates.get(facingTarget.doorKey) ?? "closed";
      if (state === "open")
        return `Open door — Press [${interactKey}] to close`;
      if (state === "closed")
        return `Closed door — Press [${interactKey}] to lock`;
      return `Locked door — Press [${interactKey}] to unlock`;
    }
    const mob = ds.initialMobs[facingTarget.mobIdx];
    const preferredRecipe = RECIPES.find(
      (r) => r.id === mob?.preferredRecipeId,
    );
    const isUnconscious = gs.mobSatiations[facingTarget.mobIdx] <= 0;
    if (isUnconscious) {
      return `${mob?.name} is unconscious — Press [space] to offer tea to revive`;
    }
    return `${mob?.name} [prefers ${preferredRecipe?.name ?? "?"}] — Press [space] to offer tea`;
  }, [
    facingTarget,
    gs.stoveStates,
    gs.doorStates,
    ds.initialMobs,
    gs.mobSatiations,
    keybindings,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Combined mobile flash + attack dirs (mobs first, then alive advs)
  const mobileFlash = useMemo(
    () => [...gs.mobDamageFlash, ...gs.advDamageFlash],
    [gs.mobDamageFlash, gs.advDamageFlash],
  );
  const mobileAttackDirs = useMemo(
    () => [...gs.mobAttackDirs, ...gs.advAttackDirs],
    [gs.mobAttackDirs, gs.advAttackDirs],
  );

  // Door visual planes — one per door placement, type based on current door state.
  const doorVisualObjects = useMemo(
    () =>
      ds.doorPlacements.map((door: any) => ({
        x: door.x,
        z: door.z,
        type: `door_state_${gs.doorStates.get(`${door.x}_${door.z}`) ?? "closed"}`,
        offsetX: door.offsetX ?? 0,
        offsetZ: door.offsetZ ?? 0,
        offsetY: door.offsetY,
        yaw: door.yaw,
      })),
    [ds.doorPlacements, gs.doorStates],
  );

  const allObjects = useMemo(
    () => [...ds.objects, ...doorVisualObjects],
    [ds.objects, doorVisualObjects],
  );

  // Cells currently occupied by player or creatures — used to open doors.
  const doorOccupiedKeys = useMemo(() => {
    const keys = new Set<string>();
    keys.add(`${Math.floor(camera.x)}_${Math.floor(camera.z)}`);
    for (const pos of gs.mobPositions) keys.add(`${pos.x}_${pos.z}`);
    for (const adv of gs.adventurers) {
      if (adv.alive) keys.add(`${adv.x}_${adv.z}`);
    }
    return keys;
  }, [camera.x, camera.z, gs.mobPositions, gs.adventurers]);

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
        {/* Main area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 3D view */}
          <div
            style={{
              flex: 1,
              position: "relative",
              outline: "1px solid #1a1816",
            }}
          >
            {/* Inset bevel overlay — sits above the WebGL canvas */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 10,
                boxShadow:
                  "inset 0 6px 0 0 #1a1816, inset 6px 0 0 0 #1e1c1a, inset 0 -6px 0 0 #7a7268, inset -6px 0 0 0 #6a6258, inset 0 18px 40px rgba(0,0,0,0.7), inset 0 -6px 12px rgba(255,255,255,0.03)",
              }}
            />
            {gs.texture && ds.solidData && (
              <PerspectiveDungeonView
                solidData={ds.solidData}
                width={dungeonWidth}
                height={dungeonHeight}
                cameraX={camera.x}
                cameraZ={camera.z}
                yaw={camera.yaw}
                atlas={gs.atlas}
                texture={gs.texture}
                floorTile={TILE_FLOOR}
                ceilingTile={TILE_CEILING}
                ceilingHeight={CEILING_H}
                wallTile={TILE_WALL}
                backgroundTile={TILE_DIRT}
                boneTexture={gs.iconTexture ?? undefined}
                renderRadius={28}
                fov={60}
                fogNear={4}
                fogFar={28}
                tileSize={TILE_SIZE}
                objects={allObjects}
                objectRegistry={gs.objectRegistry}
                objectOccupiedKeys={doorOccupiedKeys}
                mobiles={gs.mobiles}
                mobileFlash={mobileFlash}
                mobileAttackDirs={mobileAttackDirs}
                damageNumbers={gs.damageNumbers}
                spriteAtlas={gs.characterSpriteAtlas}
                adventurerSpriteAtlas={gs.characterSpriteAtlas}
                passageMask={gs.passageMask ?? undefined}
                passageOverlayIds={PASSAGE_OVERLAY_IDS}
                hazardData={ds.hazardData}
                hazardOverlayId={TRAP_GRID_OVERLAY_ID}
                speechBubbles={
                  gs.message
                    ? gs.activeSpeechBubbles.map((b) => ({
                        ...b,
                        inverted: true,
                      }))
                    : gs.activeSpeechBubbles
                }
                torchColor={torchColor}
                torchIntensity={torchIntensity}
                floorData={ds.floorData}
                wallData={ds.wallData}
                ceilingData={ds.ceilingData}
                floorTileMap={FLOOR_TILE_MAP}
                wallTileMap={WALL_TILE_MAP}
                ceilingTileMap={CEILING_TILE_MAP}
                ghostWallRadius={!gs.leftHandTea && !gs.rightHandTea ? TILE_SIZE * 1.5 : undefined}
                style={{ width: "100%", height: "100%" }}
              >
                <SpikeTrapMeshes
                  disarmedTraps={gs.disarmedTraps}
                  hazardData={ds.hazardData}
                  dungeonWidth={dungeonWidth}
                  atlas={gs.atlas}
                  texture={gs.texture}
                  tileSize={TILE_SIZE}
                  ceilingHeight={CEILING_H}
                  fogNear={4}
                  fogFar={28}
                  torchColor={torchColor}
                  torchIntensity={torchIntensity}
                />
                <CoinDropMeshes
                  drops={gs.xpDrops}
                  tileSize={TILE_SIZE}
                  fogNear={4}
                  fogFar={28}
                  torchColor={torchColor}
                  torchIntensity={torchIntensity}
                />
                <ChestMeshes
                  chests={gs.chests}
                  tileSize={TILE_SIZE}
                  fogNear={4}
                  fogFar={28}
                  torchColor={torchColor}
                  torchIntensity={torchIntensity}
                />
              </PerspectiveDungeonView>
            )}

            <WaveCountdown
              turnsLeft={gs.waveCountdown}
              visible={
                gs.waveCountdown <= WAVE_COUNTDOWN_THRESHOLD &&
                gs.adventurers.filter((a: any) => a.alive).length === 0
              }
            />

            {/* Interaction prompt */}
            {promptText && !gs.showRecipeMenu && (
              <div
                style={{
                  position: "absolute",
                  bottom: 70,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#2e2c29",
                  outline: "1px solid #1e1c1a",
                  boxShadow:
                    "inset 0 2px 0 0 #5a5450, inset 2px 0 0 0 #504a46, inset 0 -2px 0 0 #1a1816, inset -2px 0 0 0 #1e1c1a, inset 0 4px 12px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.8)",
                  backgroundImage:
                    "repeating-conic-gradient(rgba(0,0,0,0.03) 0% 25%, transparent 0% 50%)",
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

            {gs.showRecipeMenu && (
              <RecipeMenu
                recipes={RECIPES}
                ingredients={gs.ingredients}
                showMsg={gs.showMsg}
                selectedIndex={gs.recipeMenuCursor}
                keybindings={keybindings}
                onSelectRecipe={(recipe: any) => {
                  if (recipe.ingredientId) {
                    const newIng = {
                      ...gs.ingredientsRef.current,
                      [recipe.ingredientId]:
                        gs.ingredientsRef.current[recipe.ingredientId] - 1,
                    };
                    gs.ingredientsRef.current = newIng;
                    gs.setIngredients(newIng);
                  }
                  gs.setStoveStates((prev: Map<string, any>) => {
                    const next = new Map(prev);
                    next.set(gs.activeStoveKey, {
                      brewing: {
                        recipe,
                        stepsRemaining: recipe.timeToBrew,
                        ready: false,
                      },
                    });
                    return next;
                  });
                  gs.setShowRecipeMenu(false);
                  gs.showMsg(
                    `Started brewing ${recipe.name}! ${recipe.timeToBrew} steps until ready.`,
                  );
                }}
                onCancel={() => gs.setShowRecipeMenu(false)}
              />
            )}

            {/* Message */}
            {gs.message && (
              <div
                style={{
                  position: "absolute",
                  top: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#2a2720",
                  outline: "1px solid #1a1814",
                  boxShadow:
                    "inset 0 2px 0 0 #6a6058, inset 2px 0 0 0 #5a5248, inset 0 -2px 0 0 #141210, inset -2px 0 0 0 #1a1814, inset 0 4px 16px rgba(0,0,0,0.6), 0 6px 24px rgba(0,0,0,0.9)",
                  backgroundImage:
                    "repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%)",
                  backgroundSize: "4px 4px",
                  padding: "12px 28px",
                  fontSize: 17,
                  fontFamily: '"Metamorphous", serif',
                  letterSpacing: "0.06em",
                  maxWidth: 560,
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                {/* Invisible full text holds the final size */}
                <span style={{ visibility: "hidden", userSelect: "none" }}>
                  {gs.message}
                </span>
                {/* Typed text overlaid on top */}
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#e0b870",
                    padding: "12px 28px",
                  }}
                >
                  {gs.displayedText}
                </span>
              </div>
            )}
          </div>

          <MinimapSidebar
            solidData={ds.solidData}
            dungeonWidth={dungeonWidth}
            dungeonHeight={dungeonHeight}
            camera={camera}
            exploredMaskRef={gs.exploredMaskRef}
            texture={gs.texture}
            atlas={gs.atlas}
            floorTile={TILE_FLOOR}
            backgroundTile={TILE_DIRT}
            boneTexture={gs.iconTexture ?? undefined}
            floorData={ds.floorData}
            floorTileMap={FLOOR_TILE_MAP}
            tileSize={TILE_SIZE}
            mobs={gs.mobPositions.map(
              (pos: { x: number; z: number }, i: number) => ({
                x: pos.x,
                z: pos.z,
                name: (ds.initialMobs as any[])[i]?.name,
                hp: gs.mobHps[i],
                maxHp: (ds.initialMobs as any[])[i]?.hp ?? 20,
                satiation: gs.mobSatiations[i],
                maxSatiation: 40,
                rpsEffect: gs.mobRpsEffects[i],
              }),
            )}
            adventurers={gs.adventurers}
            doorPlacements={ds.doorPlacements}
            stovePlacements={ds.stovePlacements}
            hazardData={ds.hazardData}
            disarmedTraps={gs.disarmedTraps}
            chests={gs.chests}
          />
        </div>

        <DifficultyModal
          visible={gs.showSettings}
          onClose={() => gs.setShowSettings(false)}
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
          playerHp={gs.playerHp}
          playerMaxHp={PLAYER_MAX_HP}
          playerXp={gs.playerXp}
          ingredients={gs.ingredients}
          currentRoomTemp={(() => {
            const gx = Math.floor(camera.x);
            const gz = Math.floor(camera.z);
            const regionId = gs.regionIdData[gz * dungeonWidth + gx];
            return Math.min(
              255,
              127 + Math.round(gs.roomTempRise.get(regionId) ?? 0),
            );
          })()}
        />
      </div>

      <GameOverOverlay
        gameState={gs.gameState}
        gameOverReason={gs.gameOverReason}
        currentWave={gs.currentWave}
        turnCount={gs.turnCount}
        winWaves={WIN_WAVES}
        onPlayAgain={() => {
          setDungeonSeed((s) => s);
          const freshSatiations = ds.initialMobs.map(() => 40);
          gs.clearHands();
          gs.setMobSatiations(freshSatiations);
          gs.setRoomTempRise(new Map());
          gs.setStoveStates(new Map());
          gs.setShowRecipeMenu(false);
          gs.setActiveStoveKey(null);
          gs.setMessage(null);
          gs.setAdventurers([]);
          gs.setCurrentWave(0);
          gs.setTurnCount(0);
          gs.setWaveCountdown(turnsPerWave);
          gs.setPlayerXp(0);
          gs.setXpDrops([]);
          gs.setPlayerHp(PLAYER_MAX_HP);
          gs.setIngredients({ rations: 0, herbs: 0, dust: 0 });
          gs.setIngredientDrops([...ds.initialIngredientDrops]);
          gs.setChests([...ds.initialChests]);
          gs.chestsRef.current = [...ds.initialChests];
          gs.setGameState("playing");
          gs.setGameOverReason(null);
          gs.adventurersRef.current = [];
          gs.currentWaveRef.current = 0;
          gs.turnCountRef.current = 0;
          gs.waveCountdownRef.current = turnsPerWave;
          gs.playerXpRef.current = 0;
          gs.xpDropsRef.current = [];
          gs.playerHpRef.current = PLAYER_MAX_HP;
          gs.ingredientsRef.current = { rations: 0, herbs: 0, dust: 0 };
          gs.ingredientDropsRef.current = [...ds.initialIngredientDrops];
          gs.mobSatiationsRef.current = freshSatiations;
          const freshPositions = ds.initialMobs.map((m: any) => ({
            x: m.x,
            z: m.z,
          }));
          gs.setMobPositions(freshPositions);
          gs.mobPositionsRef.current = freshPositions;
          gs.ruinedNotifiedRef.current = new Set();
        }}
      />
    </>
  );
}
