import { useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  InstancedTileMesh,
  type TileInstance,
} from "../../roguelike-mazetools/src/rendering/InstancedTileMesh";
import type { TileAtlas } from "../../roguelike-mazetools/src/rendering/tileAtlas";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

/** Exponential-decay speed for yaw lerp; higher = snappier rotation. */
const YAW_LERP_K = 5;

/** Orthographic camera height above the dungeon floor. */
const CAM_Y = 200;

/** Flat white tint bands – disables distance-based darkening. */
const WHITE = new THREE.Color(1, 1, 1);
const FLAT_TINTS: [THREE.Color, THREE.Color, THREE.Color, THREE.Color] = [
  WHITE,
  WHITE,
  WHITE,
  WHITE,
];

/** Black torch colour eliminates the additive warm-yellow torch overlay. */
const BLACK_TORCH = new THREE.Color(0, 0, 0);

// ─────────────────────────────────────────────────────────────────────────────
// Floor instance builder
// ─────────────────────────────────────────────────────────────────────────────

function buildFloorInstances(
  solidData: Uint8Array,
  width: number,
  height: number,
  floorTile: number,
  tileSize: number,
  floorData: Uint8Array | undefined,
  floorTileMap: number[] | undefined,
  exploredMask: Uint8Array | null | undefined,
): TileInstance[] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-HALF_PI, 0, 0));
  const scale = new THREE.Vector3(tileSize, tileSize, 1);
  const instances: TileInstance[] = [];

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cz * width + cx;
      if (solidData[idx] > 0) continue;
      if (exploredMask && !exploredMask[idx]) continue;

      const cellFloorType = floorData ? floorData[idx] : 0;
      const tileId =
        floorData && floorTileMap && cellFloorType > 0
          ? (floorTileMap[cellFloorType] ?? floorTile)
          : floorTile;

      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3((cx + 0.5) * tileSize, 0, (cz + 0.5) * tileSize),
        q,
        scale,
      );
      instances.push({ matrix: m, tileId, cellX: cx, cellZ: cz });
    }
  }
  return instances;
}

// ─────────────────────────────────────────────────────────────────────────────
// Player arrow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flat orange disc + yellow arrowhead pointing along the group's local –Z
 * axis.  Position and rotation.y are driven imperatively by MinimapScene via
 * the forwarded ref.
 */
function PlayerArrow({
  tileSize,
  groupRef,
}: {
  tileSize: number;
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const r = tileSize * 0.32;
  const coneH = r * 1.2;

  return (
    <group ref={groupRef} renderOrder={1}>
      {/* Orange body disc */}
      <mesh rotation={[-HALF_PI, 0, 0]} renderOrder={1}>
        <circleGeometry args={[r, 16]} />
        <meshBasicMaterial color="#ff8800" depthTest={false} />
      </mesh>
      {/*
       * Yellow arrowhead cone.
       * rotation.x = -HALF_PI maps the cone's +Y (apex) → –Z so the tip
       * points in the player's forward direction.
       * position.z = -(r + coneH/2) places the base flush with the disc edge.
       */}
      <mesh
        position={[0, 0, -(r + coneH / 2)]}
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={1}
      >
        <coneGeometry args={[r * 0.65, coneH, 8]} />
        <meshBasicMaterial color="#ffff00" depthTest={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner R3F scene
// ─────────────────────────────────────────────────────────────────────────────

type SceneProps = {
  solidData: Uint8Array;
  width: number;
  height: number;
  playerX: number;
  playerZ: number;
  targetYaw: number;
  texture: THREE.Texture;
  atlas: TileAtlas;
  floorTile: number;
  floorData?: Uint8Array;
  floorTileMap?: number[];
  tileSize: number;
  exploredMaskRef?: React.RefObject<Uint8Array | null>;
};

function MinimapScene({
  solidData,
  width,
  height,
  playerX,
  playerZ,
  targetYaw,
  texture,
  atlas,
  floorTile,
  floorData,
  floorTileMap,
  tileSize,
  exploredMaskRef,
}: SceneProps) {
  const { camera } = useThree();
  const lerpedYawRef = useRef(targetYaw);
  const arrowGroupRef = useRef<THREE.Group | null>(null);

  // Stable ref so useFrame always reads the latest prop values between renders.
  const propsRef = useRef({ playerX, playerZ, targetYaw });
  propsRef.current = { playerX, playerZ, targetYaw };

  // Rebuild floor tiles when dungeon changes or the player moves (the latter
  // ensures we re-read the explored mask after each exploration step).
  const floorInstances = useMemo(
    () =>
      buildFloorInstances(
        solidData,
        width,
        height,
        floorTile,
        tileSize,
        floorData,
        floorTileMap,
        exploredMaskRef?.current,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solidData, width, height, floorTile, tileSize, floorData, floorTileMap, playerX, playerZ],
  );

  useFrame((_, delta) => {
    const { playerX: px, playerZ: pz, targetYaw: ty } = propsRef.current;

    // Shortest-path exponential-decay angular lerp.
    let diff = ty - lerpedYawRef.current;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    lerpedYawRef.current += diff * (1 - Math.exp(-YAW_LERP_K * delta));

    const yaw = lerpedYawRef.current;
    const wx = px * tileSize;
    const wz = pz * tileSize;

    // Position the orthographic camera above the player.
    // Setting `up` to the player's forward vector makes that direction appear
    // at the top of the minimap, giving a player-relative orientation.
    camera.position.set(wx, CAM_Y, wz);
    camera.up.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    camera.lookAt(wx, 0, wz);

    // Imperatively update the arrow: sit just above the floor, rotated so the
    // arrowhead points in the player's actual (un-lerped) facing direction.
    const arrow = arrowGroupRef.current;
    if (arrow) {
      arrow.position.set(wx, 0.05, wz);
      arrow.rotation.y = ty;
    }
  });

  return (
    <>
      <color attach="background" args={["#111111"]} />
      <InstancedTileMesh
        instances={floorInstances}
        atlas={atlas}
        texture={texture}
        fogNear={9999}
        fogFar={99999}
        tintColors={FLAT_TINTS}
        torchColor={BLACK_TORCH}
        torchIntensity={0}
      />
      <PlayerArrow tileSize={tileSize} groupRef={arrowGroupRef} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export type MinimapProps = {
  solidData: Uint8Array;
  dungeonWidth: number;
  dungeonHeight: number;
  camera: { x: number; z: number; yaw: number };
  texture: THREE.Texture;
  atlas: TileAtlas;
  floorTile: number;
  floorData?: Uint8Array;
  floorTileMap?: number[];
  /** World-space units per dungeon cell. Defaults to 3. */
  tileSize?: number;
  exploredMaskRef?: React.RefObject<Uint8Array | null>;
  className?: string;
};

export function Minimap({
  solidData,
  dungeonWidth,
  dungeonHeight,
  camera,
  texture,
  atlas,
  floorTile,
  floorData,
  floorTileMap,
  tileSize = 3,
  exploredMaskRef,
  className,
}: MinimapProps) {
  return (
    <div
      className={className}
      style={{ width: "100%", aspectRatio: "1", position: "relative", backgroundColor: "#111" }}
    >
      <Canvas
        orthographic
        camera={{ zoom: 4.5, near: 0.1, far: 1000 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: false }}
      >
        <MinimapScene
          solidData={solidData}
          width={dungeonWidth}
          height={dungeonHeight}
          playerX={camera.x}
          playerZ={camera.z}
          targetYaw={camera.yaw}
          texture={texture}
          atlas={atlas}
          floorTile={floorTile}
          floorData={floorData}
          floorTileMap={floorTileMap}
          tileSize={tileSize}
          exploredMaskRef={exploredMaskRef}
        />
      </Canvas>
    </div>
  );
}
