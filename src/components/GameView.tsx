import { useMemo, useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useLoader, useFrame } from "@react-three/fiber";
import { PerspectiveDungeonView } from "../../roguelike-mazetools/src/rendering/PerspectiveDungeonView";
import {
  TORCH_UNIFORMS_GLSL,
  TORCH_HASH_GLSL,
  TORCH_FNS_GLSL,
  makeTorchUniforms,
} from "../../roguelike-mazetools/src/rendering/torchLighting";
import {
  InstancedTileMesh,
  type TileInstance,
} from "../../roguelike-mazetools/src/rendering/InstancedTileMesh";
import type { TileAtlas } from "../../roguelike-mazetools/src/rendering/tileAtlas";
import { StatusBar } from "./StatusBar";
import { RoundCountdown } from "./WaveCountdown";
import { RecipeMenu } from "./RecipeMenu";
import { SummonMenu } from "./SummonMenu";
import { MinimapSidebar } from "./MinimapSidebar";
import { ActionLog } from "./ActionLog";
import { RECIPES } from "../tea";
import atlasJson from "../assets/atlas.json";
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
  ROUND_COUNTDOWN_THRESHOLD,
  ATLAS_SHEET_W,
  ATLAS_SHEET_H,
  atlasIndex,
} from "../gameConstants";
import { cardinalDir } from "../gameUtils";

// ---------------------------------------------------------------------------
// Spike trap 3D mesh
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
  m.compose(_spikeV.set(px, py, pz), _spikeQ, _spikeS.set(scaleX, -scaleY, 1));
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
    const spikeH = ceilingHeight;
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

      for (const dx of [-spacing, 0, spacing]) {
        result.push({
          matrix: buildSpikeMatrix(wx + dx, py, wz, HALF_PI, spikeH, tileSize),
          tileId: SPIKE_TRAP_OVERLAY_ID,
        });
      }
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
// Coin drop 3D mesh
// ---------------------------------------------------------------------------

const _ICONS_W = 256;
const _ICONS_H = 256;
const _ICON_PX = 32;
const COIN_UV_RECT = new THREE.Vector4(
  32 / _ICONS_W,
  1 - (128 + _ICON_PX) / _ICONS_H,
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
// Chest billboard
// ---------------------------------------------------------------------------

const _CHAR_W = 1024;
const _CHAR_H = 352;
const CHEST_UV_RECT = new THREE.Vector4(
  896 / _CHAR_W,
  1 - 64 / _CHAR_H,
  64 / _CHAR_W,
  64 / _CHAR_H,
);
const MIMIC_UV_RECT = new THREE.Vector4(
  960 / _CHAR_W,
  1 - 64 / _CHAR_H,
  64 / _CHAR_W,
  64 / _CHAR_H,
);

const _ATLAS_W = ATLAS_SHEET_W;
const _ATLAS_H = ATLAS_SHEET_H;
function spriteUvRect(name: string): THREE.Vector4 {
  const entry = atlasIndex.sprites.byName(name);
  const [px, py] = entry?.uv ?? [0, 0];
  const tileSize = atlasJson.tileSize ?? 64;
  return new THREE.Vector4(
    px / _ATLAS_W,
    1 - (py + tileSize) / _ATLAS_H,
    tileSize / _ATLAS_W,
    tileSize / _ATLAS_H,
  );
}

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

const FURNITURE_FRAG = /* glsl */ `
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
        <CoinBillboard
          key={drop.id}
          drop={drop}
          tileSize={tileSize}
          mat={mat}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Ingredient drop 3D mesh
// ---------------------------------------------------------------------------

const INGREDIENT_UV_RECTS: Record<string, THREE.Vector4> = {
  "hot-pepper": new THREE.Vector4(
    224 / _ICONS_W,
    1 - (128 + _ICON_PX) / _ICONS_H,
    _ICON_PX / _ICONS_W,
    _ICON_PX / _ICONS_H,
  ),
  "frost-leaf": new THREE.Vector4(
    192 / _ICONS_W,
    1 - (128 + _ICON_PX) / _ICONS_H,
    _ICON_PX / _ICONS_W,
    _ICON_PX / _ICONS_H,
  ),
  "wild-herb": new THREE.Vector4(
    160 / _ICONS_W,
    1 - (128 + _ICON_PX) / _ICONS_H,
    _ICON_PX / _ICONS_W,
    _ICON_PX / _ICONS_H,
  ),
};

function IngredientDropMeshes({
  drops,
  tileSize = 1,
  fogNear = 4,
  fogFar = 28,
  torchColor,
  torchIntensity,
}: {
  drops: { dropKey: string; id: string; x: number; z: number }[];
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

  const mats = useMemo(() => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return Object.fromEntries(
      Object.entries(INGREDIENT_UV_RECTS).map(([id, uvRect]) => [
        id,
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
          vertexShader: COIN_VERT,
          fragmentShader: COIN_FRAG,
          transparent: true,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        }),
      ]),
    );
  }, [texture, fogNear, fogFar]);

  const torchColorObj = useMemo(
    () => (torchColor ? new THREE.Color(torchColor) : undefined),
    [torchColor],
  );
  useEffect(() => {
    if (torchColorObj)
      Object.values(mats).forEach(
        (m) => (m.uniforms.uTorchColor.value = torchColorObj),
      );
  }, [torchColorObj, mats]);
  useEffect(() => {
    if (torchIntensity !== undefined)
      Object.values(mats).forEach(
        (m) => (m.uniforms.uTorchIntensity.value = torchIntensity),
      );
  }, [torchIntensity, mats]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    Object.values(mats).forEach((m) => (m.uniforms.uTime.value = t));
  });

  return (
    <>
      {drops.map((drop) => {
        const mat = mats[drop.id];
        if (!mat) return null;
        return (
          <CoinBillboard
            key={drop.dropKey}
            drop={drop}
            tileSize={tileSize}
            mat={mat}
          />
        );
      })}
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
    [texture, fogNear, fogFar],
  );

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
        <ChestBillboard
          key={chest.id}
          chest={chest}
          tileSize={tileSize}
          mat={mat}
          mimicMat={mimicMat}
        />
      ))}
    </>
  );
}

function FurnitureBillboard({
  item,
  tileSize,
  mat,
}: {
  item: { x: number; z: number };
  tileSize: number;
  mat: THREE.ShaderMaterial;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const size = tileSize * 0.6;
  const wx = (item.x + 0.5) * tileSize;
  const wz = (item.z + 0.5) * tileSize;

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
      position={[wx, size / 2, wz]}
      scale={[size, size, 1]}
    />
  );
}

function FurnitureMeshes({
  items,
  tileSize = 1,
  fogNear = 4,
  fogFar = 28,
  torchColor,
  torchIntensity,
}: {
  items: { id: string; x: number; z: number; type: string }[];
  tileSize?: number;
  fogNear?: number;
  fogFar?: number;
  torchColor?: string;
  torchIntensity?: number;
}) {
  const texture = useLoader(
    THREE.TextureLoader,
    `${import.meta.env.BASE_URL}textures/atlas.png`,
  );

  const matsByType = useMemo(() => {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    const types = [...new Set(items.map((i) => i.type))];
    return Object.fromEntries(
      types.map((type) => [
        type,
        new THREE.ShaderMaterial({
          uniforms: {
            uAtlas: { value: texture },
            uUvRect: { value: spriteUvRect(type) },
            uFogColor: { value: new THREE.Color(0, 0, 0) },
            uFogNear: { value: fogNear },
            uFogFar: { value: fogFar },
            ...makeTorchUniforms(),
          },
          vertexShader: CHEST_VERT,
          fragmentShader: FURNITURE_FRAG,
          transparent: true,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        }),
      ]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, fogNear, fogFar]);

  const torchColorObj = useMemo(
    () => (torchColor ? new THREE.Color(torchColor) : undefined),
    [torchColor],
  );
  useEffect(() => {
    if (torchColorObj)
      Object.values(matsByType).forEach(
        (m) => (m.uniforms.uTorchColor.value = torchColorObj),
      );
  }, [torchColorObj, matsByType]);
  useEffect(() => {
    if (torchIntensity !== undefined)
      Object.values(matsByType).forEach(
        (m) => (m.uniforms.uTorchIntensity.value = torchIntensity),
      );
  }, [torchIntensity, matsByType]);

  return (
    <>
      {items.map((item) => (
        <FurnitureBillboard
          key={item.id}
          item={item}
          tileSize={tileSize}
          mat={matsByType[item.type]}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// GameView — shared renderer used by both App and Tutorial
// ---------------------------------------------------------------------------

export interface GameViewDs {
  solidData: Uint8Array | null;
  floorData: any;
  wallData: any;
  ceilingData: any;
  objects: any[];
  doorPlacements: any[];
  stovePlacements: any[];
  hazardData: Uint8Array;
  initialMobs: any[];
  initialFurniture?: any[];
}

interface GameViewProps {
  gs: any;
  ds: GameViewDs;
  camera: { x: number; z: number; yaw: number };
  facingTarget: any;
  dungeonWidth: number;
  dungeonHeight: number;
  torchColor: string;
  torchIntensity: number;
  keybindings: any;
  /** Extra content rendered in the top-right corner of the 3D view (e.g. tutorial badge) */
  topRight?: ReactNode;
  /** Settings / difficulty modal rendered inside the main layout */
  settingsModal?: ReactNode;
  /** Full-screen overlay rendered after the main layout (e.g. GameOverOverlay) */
  gameOverlay?: ReactNode;
  onOpenSettings?: () => void;
  openMenuKeys?: string[];
  summonMonsterKeys?: string[];
}

export function GameView({
  gs,
  ds,
  camera,
  facingTarget,
  dungeonWidth,
  dungeonHeight,
  torchColor,
  torchIntensity,
  keybindings,
  topRight,
  settingsModal,
  gameOverlay,
  onOpenSettings,
  openMenuKeys,
  summonMonsterKeys,
}: GameViewProps) {
  const mobileFlash = useMemo(
    () => [...(gs.mobDamageFlash ?? []), ...(gs.advDamageFlash ?? [])],
    [gs.mobDamageFlash, gs.advDamageFlash],
  );
  const mobileAttackDirs = useMemo(
    () => [...(gs.mobAttackDirs ?? []), ...(gs.advAttackDirs ?? [])],
    [gs.mobAttackDirs, gs.advAttackDirs],
  );

  const doorVisualObjects = useMemo(
    () =>
      ds.doorPlacements.map((door: any) => ({
        x: door.x,
        z: door.z,
        type: `door_state_${gs.doorStates?.get(`${door.x}_${door.z}`) ?? "closed"}`,
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

  const doorOccupiedKeys = useMemo(() => {
    const keys = new Set<string>();
    keys.add(`${Math.floor(camera.x)}_${Math.floor(camera.z)}`);
    for (const pos of gs.mobPositions) keys.add(`${pos.x}_${pos.z}`);
    for (const adv of gs.adventurers ?? []) {
      if (adv.alive) keys.add(`${adv.x}_${adv.z}`);
    }
    return keys;
  }, [camera.x, camera.z, gs.mobPositions, gs.adventurers]);

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
      const state = gs.doorStates?.get(facingTarget.doorKey) ?? "closed";
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
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 3D view */}
          <div
            style={{
              flex: 1,
              position: "relative",
              outline: "1px solid #1a1816",
            }}
          >
            {/* Inset bevel overlay */}
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
                itemTexture={gs.iconTexture ?? undefined}
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
                    ? gs.activeSpeechBubbles.map((b: any) => ({
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
                ghostWallRadius={
                  !gs.leftHandTea && !gs.rightHandTea
                    ? TILE_SIZE * 1.5
                    : undefined
                }
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
                  drops={gs.xpDrops ?? []}
                  tileSize={TILE_SIZE}
                  fogNear={4}
                  fogFar={28}
                  torchColor={torchColor}
                  torchIntensity={torchIntensity}
                />
                <IngredientDropMeshes
                  drops={gs.ingredientDrops ?? []}
                  tileSize={TILE_SIZE}
                  fogNear={4}
                  fogFar={28}
                  torchColor={torchColor}
                  torchIntensity={torchIntensity}
                />
                <ChestMeshes
                  chests={gs.chests ?? []}
                  tileSize={TILE_SIZE}
                  fogNear={4}
                  fogFar={28}
                  torchColor={torchColor}
                  torchIntensity={torchIntensity}
                />
                <FurnitureMeshes
                  items={ds.initialFurniture ?? []}
                  tileSize={TILE_SIZE}
                  fogNear={4}
                  fogFar={28}
                  torchColor={torchColor}
                  torchIntensity={torchIntensity}
                />
              </PerspectiveDungeonView>
            )}

            <RoundCountdown
              turnsLeft={gs.roundCountdown}
              visible={
                gs.roundCountdown <= ROUND_COUNTDOWN_THRESHOLD &&
                (gs.adventurers ?? []).filter((a: any) => a.alive).length === 0
              }
            />

            {/* Interaction prompt */}
            {promptText && !gs.showRecipeMenu && !gs.showSummonMenu && (
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
                    gs.applyIngredients(newIng);
                    console.log("new ing", newIng);
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

            {gs.showSummonMenu && (
              <SummonMenu
                mobs={(ds.initialMobs as any[]).map((m: any, i: number) => ({
                  name: m.name,
                  hasMet: gs.mobHasMet[i] ?? false,
                }))}
                selectedIndex={gs.summonMenuCursor}
                onSelectMob={(mobIdx: number) => {
                  const { x: px, z: pz } = gs.logicalRef.current;
                  const pgx = Math.floor(px);
                  const pgz = Math.floor(pz);
                  gs.summonMob(mobIdx, pgx, pgz);
                  gs.setShowSummonMenu(false);
                }}
                onCancel={() => gs.setShowSummonMenu(false)}
                keybindings={keybindings}
              />
            )}

            {/* Action log */}
            <ActionLog messages={gs.messageLog} />

            {/* Message box */}
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
                <span style={{ visibility: "hidden", userSelect: "none" }}>
                  {gs.message}
                </span>
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

            {topRight}
          </div>

          <MinimapSidebar
            solidData={ds.solidData}
            dungeonWidth={dungeonWidth}
            dungeonHeight={dungeonHeight}
            camera={camera}
            summonMob={gs.summonMob}
            exploredMaskRef={gs.exploredMaskRef}
            texture={gs.texture}
            atlas={gs.atlas}
            floorTile={TILE_FLOOR}
            backgroundTile={TILE_DIRT}
            itemTexture={gs.iconTexture ?? undefined}
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
            adventurers={gs.adventurers ?? []}
            doorPlacements={ds.doorPlacements}
            stovePlacements={ds.stovePlacements}
            hazardData={ds.hazardData}
            disarmedTraps={gs.disarmedTraps}
            chests={gs.chests ?? []}
            furniturePlacements={ds.initialFurniture}
            goldDrops={gs.xpDrops ?? []}
            itemDrops={gs.ingredientDrops ?? []}
          />
        </div>

        {settingsModal}

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
          openMenuKeys={openMenuKeys}
          summonMonsterKeys={summonMonsterKeys}
          onOpenSettings={onOpenSettings}
        />
      </div>

      {gameOverlay}
    </>
  );
}
