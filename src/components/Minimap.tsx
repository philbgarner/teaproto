import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

/** Exponential-decay speed for yaw lerp; higher = snappier rotation. */
const YAW_LERP_K = 5;

/** Orthographic camera height above the dungeon floor. */
const CAM_Y = 200;

const DEFAULT_ZOOM = 4.5;

const FLOOR_COLOR = new THREE.Color(0.25, 0.22, 0.32);
const planeGeo = new THREE.PlaneGeometry(1, 1);
const floorMat = new THREE.MeshBasicMaterial({ color: FLOOR_COLOR });

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(0,0,0,0.82)",
  color: "#fff",
  padding: "2px 7px",
  borderRadius: 3,
  fontSize: 10,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
  transform: "translate(-50%, calc(-100% - 6px))",
};

// ─────────────────────────────────────────────────────────────────────────────
// Entity prop types
// ─────────────────────────────────────────────────────────────────────────────

export type MinimapMob = {
  x: number;
  z: number;
  name?: string;
  hp?: number;
  maxHp?: number;
  satiation?: number;
  maxSatiation?: number;
  rpsEffect?: string;
};
export type MinimapAdventurer = {
  x: number;
  z: number;
  alive: boolean;
  name?: string;
};
export type MinimapDoor = { x: number; z: number };
export type MinimapStove = { x: number; z: number };
export type MinimapGoldDrop = { x: number; z: number; amount: number };
export type MinimapItemDrop = { x: number; z: number; name?: string };

// ─────────────────────────────────────────────────────────────────────────────
// Floor tiles (flat-color instanced mesh, no texture or shading)
// ─────────────────────────────────────────────────────────────────────────────

type FloorCell = { matrix: THREE.Matrix4 };

function buildFloorCells(
  solidData: Uint8Array,
  width: number,
  height: number,
  tileSize: number,
  exploredMask: Uint8Array | null | undefined,
): FloorCell[] {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-HALF_PI, 0, 0),
  );
  const scale = new THREE.Vector3(tileSize, tileSize, 1);
  const cells: FloorCell[] = [];

  for (let cz = 0; cz < height; cz++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = cz * width + cx;
      if (solidData[idx] > 0) continue;
      if (exploredMask && !exploredMask[idx]) continue;

      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3((cx + 0.5) * tileSize, 0, (cz + 0.5) * tileSize),
        q,
        scale,
      );
      cells.push({ matrix: m });
    }
  }
  return cells;
}

function FloorTiles({ cells }: { cells: FloorCell[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    cells.forEach((c, i) => mesh.setMatrixAt(i, c.matrix));
    mesh.instanceMatrix.needsUpdate = true;
  }, [cells]);

  return (
    <instancedMesh ref={meshRef} args={[planeGeo, floorMat, cells.length]} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Furniture dot — small dark grey square
// ─────────────────────────────────────────────────────────────────────────────

function FurnitureDot({
  x,
  z,
  tileSize,
}: {
  x: number;
  z: number;
  tileSize: number;
}) {
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;
  const size = tileSize * 0.35;
  return (
    <mesh position={[wx, 0.02, wz]} rotation={[-HALF_PI, 0, 0]} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial color="#555555" depthTest={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Teaomatic floor overlay (cyan tinted tile)
// ─────────────────────────────────────────────────────────────────────────────

function StoveTile({
  x,
  z,
  tileSize,
}: {
  x: number;
  z: number;
  tileSize: number;
}) {
  const [hovered, setHovered] = useState(false);
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;

  return (
    <group position={[wx, 0.01, wz]}>
      <mesh
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={1}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[tileSize, tileSize]} />
        <meshBasicMaterial color="#00b8da" depthTest={false} />
      </mesh>
      {hovered && <Html style={TOOLTIP_STYLE}>Teaomatic</Html>}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chest icon — tan square tile
// ─────────────────────────────────────────────────────────────────────────────

function ChestIcon({
  x,
  z,
  tileSize,
}: {
  x: number;
  z: number;
  tileSize: number;
}) {
  const [hovered, setHovered] = useState(false);
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;

  return (
    <group position={[wx, 0.02, wz]}>
      <mesh
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={2}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[tileSize * 0.7, tileSize * 0.5]} />
        <meshBasicMaterial color="#c8a46e" depthTest={false} />
      </mesh>
      {hovered && <Html style={TOOLTIP_STYLE}>Chest</Html>}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gold drop icon — small yellow rotated square (diamond)
// ─────────────────────────────────────────────────────────────────────────────

function GoldDropIcon({
  x,
  z,
  tileSize,
  amount,
}: {
  x: number;
  z: number;
  tileSize: number;
  amount: number;
}) {
  const [hovered, setHovered] = useState(false);
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;
  const s = tileSize * 0.38;

  return (
    <group position={[wx, 0.03, wz]}>
      <mesh
        rotation={[-HALF_PI, 0, Math.PI / 4]}
        renderOrder={2}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial color="#f5c842" depthTest={false} />
      </mesh>
      {hovered && <Html style={TOOLTIP_STYLE}>{amount} gold</Html>}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item drop icon — small purple square
// ─────────────────────────────────────────────────────────────────────────────

function ItemDropIcon({
  x,
  z,
  tileSize,
  name,
}: {
  x: number;
  z: number;
  tileSize: number;
  name?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;
  const s = tileSize * 0.32;

  return (
    <group position={[wx, 0.04, wz]}>
      <mesh
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={2}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial color="#c46ef5" depthTest={false} />
      </mesh>
      {hovered && <Html style={TOOLTIP_STYLE}>{name ?? "Item"}</Html>}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Circle icon — mobs (green) and adventurers (red)
// ─────────────────────────────────────────────────────────────────────────────

function ArcRing({
  inner,
  outer,
  fraction,
  bgColor,
  fgColor,
  renderOrder,
}: {
  inner: number;
  outer: number;
  fraction: number;
  bgColor: string;
  fgColor: string;
  renderOrder: number;
}) {
  const frac = Math.max(0, Math.min(1, fraction));
  return (
    <>
      {/* background full ring */}
      <mesh rotation={[-HALF_PI, 0, 0]} renderOrder={renderOrder}>
        <ringGeometry args={[inner, outer, 32, 1, 0, TWO_PI]} />
        <meshBasicMaterial color={bgColor} depthTest={false} />
      </mesh>
      {/* foreground arc */}
      {frac > 0 && (
        <mesh
          rotation={[-HALF_PI, 0, -HALF_PI]}
          renderOrder={renderOrder + 0.1}
        >
          <ringGeometry args={[inner, outer, 32, 1, 0, TWO_PI * frac]} />
          <meshBasicMaterial color={fgColor} depthTest={false} />
        </mesh>
      )}
    </>
  );
}

const RPS_COLORS: Record<string, string> = {
  poisoned: "#22dd44",
  freezing: "#44aaff",
  bleeding: "#ff3333",
};

function CircleIcon({
  x,
  z,
  tileSize,
  color,
  tooltip,
  hp,
  maxHp,
  satiation,
  maxSatiation,
  rpsEffect,
  onHover,
}: {
  x: number;
  z: number;
  tileSize: number;
  color: string;
  tooltip: ReactNode;
  hp?: number;
  maxHp?: number;
  satiation?: number;
  maxSatiation?: number;
  rpsEffect?: string;
  onHover: (pos: { x: number; y: number } | null, content: ReactNode) => void;
}) {
  const r = tileSize * 0.3;
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;

  const showBars =
    hp !== undefined &&
    maxHp !== undefined &&
    satiation !== undefined &&
    maxSatiation !== undefined;
  const hpFrac = showBars ? hp! / maxHp! : 1;
  const satFrac = showBars ? satiation! / maxSatiation! : 1;
  const unconscious = showBars && hp === 0;
  const rpsColor =
    rpsEffect && rpsEffect !== "none" ? RPS_COLORS[rpsEffect] : null;
  const displayColor = unconscious
    ? "#dddd00"
    : (rpsColor ?? (rpsEffect === "none" ? "#f1f1f1" : color));

  return (
    <group position={[wx, 0.1, wz]}>
      <mesh
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={2}
        onPointerEnter={(e) => {
          e.stopPropagation();
          onHover(
            { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            tooltip,
          );
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover(
            { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            tooltip,
          );
        }}
        onPointerLeave={() => onHover(null, null)}
      >
        <circleGeometry args={[r, 16]} />
        <meshBasicMaterial color={displayColor} depthTest={false} />
      </mesh>
      {showBars && (
        <>
          <ArcRing
            inner={r * 1.15}
            outer={r * 1.55}
            fraction={hpFrac}
            bgColor="#660000"
            fgColor="#ff4444"
            renderOrder={3}
          />
          <ArcRing
            inner={r * 1.65}
            outer={r * 2.05}
            fraction={satFrac}
            bgColor="#006060"
            fgColor="#44dddd"
            renderOrder={3}
          />
        </>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Door icon — filled rect when closed, faded when open
// ─────────────────────────────────────────────────────────────────────────────

function DoorIcon({
  x,
  z,
  tileSize,
  isOpen,
}: {
  x: number;
  z: number;
  tileSize: number;
  isOpen: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;

  return (
    <group position={[wx, 0.05, wz]}>
      <mesh
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={2}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[tileSize * 0.75, tileSize * 0.18]} />
        <meshBasicMaterial
          color="#6e8499"
          transparent
          opacity={isOpen ? 0.3 : 1.0}
          depthTest={false}
        />
      </mesh>
      {hovered && (
        <Html style={TOOLTIP_STYLE}>
          {isOpen ? "Door (open)" : "Door (closed)"}
        </Html>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trap icon — red square for armed, dark square for disarmed/fired
// ─────────────────────────────────────────────────────────────────────────────

function TrapIcon({
  x,
  z,
  tileSize,
  disarmed,
}: {
  x: number;
  z: number;
  tileSize: number;
  disarmed: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const wx = (x + 0.5) * tileSize;
  const wz = (z + 0.5) * tileSize;
  const s = tileSize * 0.45;

  return (
    <group position={[wx, 0.06, wz]}>
      <mesh
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={2}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial
          color={disarmed ? "#0e0e0e" : "#cc1010"}
          depthTest={false}
        />
      </mesh>
      {hovered && (
        <Html style={TOOLTIP_STYLE}>
          {disarmed ? "Spike Trap (disarmed)" : "Spike Trap (armed)"}
        </Html>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player arrow
// ─────────────────────────────────────────────────────────────────────────────

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
    <group ref={groupRef} renderOrder={3}>
      <mesh rotation={[-HALF_PI, 0, 0]} renderOrder={3}>
        <circleGeometry args={[r, 16]} />
        <meshBasicMaterial color="#ff8800" depthTest={false} />
      </mesh>
      <mesh
        position={[0, 0, -(r + coneH / 2)]}
        rotation={[-HALF_PI, 0, 0]}
        renderOrder={3}
      >
        <coneGeometry args={[r * 0.65, coneH, 8]} />
        <meshBasicMaterial color="#ffff00" depthTest={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Off-screen teaomatic indicator — triangle at viewport edge pointing toward it
// ─────────────────────────────────────────────────────────────────────────────

function TeaomaticIndicator({
  stove,
  tileSize,
  propsRef,
  lerpedYawRef,
}: {
  stove: MinimapStove;
  tileSize: number;
  propsRef: React.RefObject<{
    playerX: number;
    playerZ: number;
    targetYaw: number;
  }>;
  lerpedYawRef: React.RefObject<number>;
}) {
  const { camera, size } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const sx = (stove.x + 0.5) * tileSize;
  const sz = (stove.z + 0.5) * tileSize;

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const { playerX: px, playerZ: pz } = propsRef.current;
    const yaw = lerpedYawRef.current;

    const pwx = px * tileSize;
    const pwz = pz * tileSize;

    const dx = sx - pwx;
    const dz = sz - pwz;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    // Project world displacement into camera view space (X = right, Y = up)
    const vx = dx * cosY - dz * sinY;
    const vy = -dx * sinY - dz * cosY;

    const cam = camera as THREE.OrthographicCamera;
    const halfW = size.width / (2 * cam.zoom);
    const halfH = size.height / (2 * cam.zoom);

    if (Math.abs(vx) <= halfW && Math.abs(vy) <= halfH) {
      group.visible = false;
      return;
    }
    group.visible = true;

    // Ray-box intersection: find t where ray (0,0)→(vx,vy) hits the frustum edge
    const tx = vx !== 0 ? halfW / Math.abs(vx) : Infinity;
    const ty = vy !== 0 ? halfH / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty) * 0.9; // 10% inset so triangle is fully visible

    const edgeVx = vx * t;
    const edgeVy = vy * t;

    // Back-project from view space to world XZ
    // right_world = (cosY, 0, -sinY),  up_world = (-sinY, 0, -cosY)
    const worldX = pwx + edgeVx * cosY + edgeVy * -sinY;
    const worldZ = pwz + edgeVx * -sinY + edgeVy * -cosY;

    group.position.set(worldX, 0.2, worldZ);
    // Rotate so triangle apex points toward stove
    group.rotation.y = Math.atan2(dx, dz);
  });

  const triSize = tileSize * 0.55;

  return (
    <group ref={groupRef}>
      {/* coneGeometry default apex is +Y; rotation flattens it so apex → +Z;
          group.rotation.y then aims it at the stove in world space */}
      <mesh rotation={[-HALF_PI, 0, Math.PI]} renderOrder={10}>
        <coneGeometry args={[triSize * 0.65, triSize * 1.4, 3]} />
        <meshBasicMaterial
          color="#00b8da"
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Off-screen adventurer indicator — red triangle at viewport edge pointing toward it
// ─────────────────────────────────────────────────────────────────────────────

function AdventurerIndicator({
  adventurer,
  tileSize,
  propsRef,
  lerpedYawRef,
}: {
  adventurer: MinimapAdventurer;
  tileSize: number;
  propsRef: React.RefObject<{
    playerX: number;
    playerZ: number;
    targetYaw: number;
  }>;
  lerpedYawRef: React.RefObject<number>;
}) {
  const { camera, size } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const ax = (adventurer.x + 0.5) * tileSize;
  const az = (adventurer.z + 0.5) * tileSize;

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const { playerX: px, playerZ: pz } = propsRef.current;
    const yaw = lerpedYawRef.current;

    const pwx = px * tileSize;
    const pwz = pz * tileSize;

    const dx = ax - pwx;
    const dz = az - pwz;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const vx = dx * cosY - dz * sinY;
    const vy = -dx * sinY - dz * cosY;

    const cam = camera as THREE.OrthographicCamera;
    const halfW = size.width / (2 * cam.zoom);
    const halfH = size.height / (2 * cam.zoom);

    if (Math.abs(vx) <= halfW && Math.abs(vy) <= halfH) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const tx = vx !== 0 ? halfW / Math.abs(vx) : Infinity;
    const ty = vy !== 0 ? halfH / Math.abs(vy) : Infinity;
    const t = Math.min(tx, ty) * 0.9;

    const edgeVx = vx * t;
    const edgeVy = vy * t;

    const worldX = pwx + edgeVx * cosY + edgeVy * -sinY;
    const worldZ = pwz + edgeVx * -sinY + edgeVy * -cosY;

    group.position.set(worldX, 0.2, worldZ);
    group.rotation.y = Math.atan2(dx, dz);
  });

  const triSize = tileSize * 0.55;

  return (
    <group ref={groupRef}>
      <mesh rotation={[-HALF_PI, 0, Math.PI]} renderOrder={10}>
        <coneGeometry args={[triSize * 0.65, triSize * 1.4, 3]} />
        <meshBasicMaterial
          color="#ff2222"
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner R3F scene
// ─────────────────────────────────────────────────────────────────────────────

type MinimapChest = { x: number; z: number };

type SceneProps = {
  solidData: Uint8Array;
  width: number;
  height: number;
  playerX: number;
  playerZ: number;
  targetYaw: number;
  tileSize: number;
  exploredMaskRef?: React.RefObject<Uint8Array | null>;
  mobs: MinimapMob[];
  adventurers: MinimapAdventurer[];
  doorPlacements: MinimapDoor[];
  stovePlacements: MinimapStove[];
  hazardData?: Uint8Array;
  disarmedTraps: Set<string>;
  chests: MinimapChest[];
  furniturePlacements: { x: number; z: number }[];
  goldDrops: MinimapGoldDrop[];
  itemDrops: MinimapItemDrop[];
  scale: number;
  setTooltip: (
    t: { pos: { x: number; y: number }; content: ReactNode } | null,
  ) => void;
};

function MinimapScene({
  solidData,
  width,
  height,
  playerX,
  playerZ,
  targetYaw,
  tileSize,
  exploredMaskRef,
  mobs,
  adventurers,
  doorPlacements,
  stovePlacements,
  hazardData,
  disarmedTraps,
  chests,
  furniturePlacements,
  goldDrops,
  itemDrops,
  scale,
  setTooltip,
}: SceneProps) {
  const { camera } = useThree();
  const lerpedYawRef = useRef(targetYaw);
  const arrowGroupRef = useRef<THREE.Group | null>(null);

  const propsRef = useRef({ playerX, playerZ, targetYaw });
  propsRef.current = { playerX, playerZ, targetYaw };

  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = scale;
    cam.updateProjectionMatrix();
  }, [camera, scale]);

  const floorCells = useMemo(
    () =>
      buildFloorCells(
        solidData,
        width,
        height,
        tileSize,
        exploredMaskRef?.current,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solidData, width, height, tileSize, playerX, playerZ],
  );

  const occupiedCells = useMemo(() => {
    const s = new Set<string>();
    mobs.forEach((m) => s.add(`${m.x}_${m.z}`));
    adventurers.filter((a) => a.alive).forEach((a) => s.add(`${a.x}_${a.z}`));
    return s;
  }, [mobs, adventurers]);

  const trapList = useMemo(() => {
    if (!hazardData) return [];
    const traps: { x: number; z: number; disarmed: boolean }[] = [];
    for (let cz = 0; cz < height; cz++) {
      for (let cx = 0; cx < width; cx++) {
        const idx = cz * width + cx;
        if (hazardData[idx] !== 1) continue;
        if (exploredMaskRef?.current && !exploredMaskRef.current[idx]) continue;
        traps.push({
          x: cx,
          z: cz,
          disarmed: disarmedTraps.has(`${cx}_${cz}`),
        });
      }
    }
    return traps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazardData, width, height, disarmedTraps, playerX, playerZ]);

  useFrame((_, delta) => {
    const { playerX: px, playerZ: pz, targetYaw: ty } = propsRef.current;

    let diff = ty - lerpedYawRef.current;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    lerpedYawRef.current += diff * (1 - Math.exp(-YAW_LERP_K * delta));

    const yaw = lerpedYawRef.current;
    const wx = px * tileSize;
    const wz = pz * tileSize;

    camera.position.set(wx, CAM_Y, wz);
    camera.up.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    camera.lookAt(wx, 0, wz);

    const arrow = arrowGroupRef.current;
    if (arrow) {
      arrow.position.set(wx, 0.05, wz);
      arrow.rotation.y = ty;
    }
  });

  return (
    <>
      <color attach="background" args={["#050208"]} />
      <FloorTiles cells={floorCells} />

      {furniturePlacements.map((f, i) => (
        <FurnitureDot key={`furn_${i}`} x={f.x} z={f.z} tileSize={tileSize} />
      ))}

      {stovePlacements.map((s) => (
        <StoveTile
          key={`stove_${s.x}_${s.z}`}
          x={s.x}
          z={s.z}
          tileSize={tileSize}
        />
      ))}

      {chests.map((c, i) => (
        <ChestIcon key={`chest_${i}`} x={c.x} z={c.z} tileSize={tileSize} />
      ))}

      {goldDrops.map((g, i) => (
        <GoldDropIcon
          key={`gold_${i}`}
          x={g.x}
          z={g.z}
          tileSize={tileSize}
          amount={g.amount}
        />
      ))}

      {itemDrops.map((d, i) => (
        <ItemDropIcon
          key={`item_${i}`}
          x={d.x}
          z={d.z}
          tileSize={tileSize}
          name={d.name}
        />
      ))}

      {trapList.map((t) => (
        <TrapIcon
          key={`trap_${t.x}_${t.z}`}
          x={t.x}
          z={t.z}
          tileSize={tileSize}
          disarmed={t.disarmed}
        />
      ))}

      {doorPlacements.map((d, i) => (
        <DoorIcon
          key={`door_${d.x}_${d.z}_${i}`}
          x={d.x}
          z={d.z}
          tileSize={tileSize}
          isOpen={occupiedCells.has(`${d.x}_${d.z}`)}
        />
      ))}

      {mobs.map((m, i) => {
        const effectLabel =
          m.rpsEffect && m.rpsEffect !== "none"
            ? {
                poisoned: "Poisoned",
                freezing: "Frozen",
                bleeding: "Bleeding",
              }[m.rpsEffect]
            : null;
        const effectColor = m.rpsEffect ? RPS_COLORS[m.rpsEffect] : undefined;
        const tooltip = (
          <div>
            <div>{m.name ?? "Monster"}</div>
            {effectLabel && (
              <div style={{ color: effectColor }}>{effectLabel}</div>
            )}
            {m.satiation !== undefined && (
              <div style={{ color: "#44dddd" }}>
                Armor: {m.satiation.toFixed(0)}
              </div>
            )}
            {m.hp !== undefined && m.maxHp !== undefined && (
              <div style={{ color: "#ff4444" }}>
                HP: {m.hp.toFixed(0)}/{m.maxHp}
              </div>
            )}
          </div>
        );
        return (
          <CircleIcon
            key={`mob_${i}`}
            x={m.x}
            z={m.z}
            tileSize={tileSize}
            color="#22dd44"
            tooltip={tooltip}
            hp={m.hp}
            maxHp={m.maxHp}
            satiation={m.satiation}
            maxSatiation={m.maxSatiation}
            rpsEffect={m.rpsEffect}
            onHover={(pos, content) =>
              setTooltip(pos ? { pos, content } : null)
            }
          />
        );
      })}

      {adventurers
        .filter((a) => a.alive)
        .map((a, i) => (
          <CircleIcon
            key={`adv_${i}`}
            x={a.x}
            z={a.z}
            tileSize={tileSize}
            color="#e02222"
            tooltip={a.name ?? "Adventurer"}
            onHover={(pos, content) =>
              setTooltip(pos ? { pos, content } : null)
            }
          />
        ))}

      <PlayerArrow tileSize={tileSize} groupRef={arrowGroupRef} />

      {stovePlacements[0] && (
        <TeaomaticIndicator
          stove={stovePlacements[0]}
          tileSize={tileSize}
          propsRef={propsRef}
          lerpedYawRef={lerpedYawRef}
        />
      )}

      {adventurers
        .filter((a) => a.alive)
        .map((a, i) => (
          <AdventurerIndicator
            key={`adv_indicator_${i}`}
            adventurer={a}
            tileSize={tileSize}
            propsRef={propsRef}
            lerpedYawRef={lerpedYawRef}
          />
        ))}
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
  /** World-space units per dungeon cell. Defaults to 3. */
  tileSize?: number;
  exploredMaskRef?: React.RefObject<Uint8Array | null>;
  className?: string;
  mobs?: MinimapMob[];
  adventurers?: MinimapAdventurer[];
  doorPlacements?: MinimapDoor[];
  stovePlacements?: MinimapStove[];
  hazardData?: Uint8Array;
  disarmedTraps?: Set<string>;
  chests?: MinimapChest[];
  furniturePlacements?: { x: number; z: number }[];
  goldDrops?: MinimapGoldDrop[];
  itemDrops?: MinimapItemDrop[];
  /** Orthographic zoom level. Defaults to 4.5. */
  scale?: number;
  // Legacy props kept for call-site compatibility
  texture?: unknown;
  atlas?: unknown;
  floorTile?: unknown;
  floorData?: unknown;
  floorTileMap?: unknown;
};

export function Minimap({
  solidData,
  dungeonWidth,
  dungeonHeight,
  camera,
  tileSize = 3,
  exploredMaskRef,
  className,
  mobs = [],
  adventurers = [],
  doorPlacements = [],
  stovePlacements = [],
  hazardData,
  disarmedTraps = new Set(),
  chests = [],
  furniturePlacements = [],
  goldDrops = [],
  itemDrops = [],
  scale = DEFAULT_ZOOM,
}: MinimapProps) {
  const [tooltip, setTooltip] = useState<{
    pos: { x: number; y: number };
    content: ReactNode;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el || !tooltip) return;
    const rect = el.getBoundingClientRect();
    const MARGIN = 6;
    let left = tooltip.pos.x - rect.width / 2;
    let top = tooltip.pos.y - rect.height - 10;
    left = Math.max(
      MARGIN,
      Math.min(window.innerWidth - rect.width - MARGIN, left),
    );
    top = Math.max(MARGIN, top);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transform = "none";
    el.style.visibility = "visible";
  }, [tooltip]);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        aspectRatio: "1",
        position: "relative",
        backgroundColor: "#111",
      }}
    >
      <Canvas
        orthographic
        camera={{ zoom: scale, near: 0.1, far: 1000 }}
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
          tileSize={tileSize}
          exploredMaskRef={exploredMaskRef}
          mobs={mobs}
          adventurers={adventurers}
          doorPlacements={doorPlacements}
          stovePlacements={stovePlacements}
          hazardData={hazardData}
          disarmedTraps={disarmedTraps}
          chests={chests}
          furniturePlacements={furniturePlacements}
          goldDrops={goldDrops}
          itemDrops={itemDrops}
          scale={scale}
          setTooltip={setTooltip}
        />
      </Canvas>
      {tooltip &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              ...TOOLTIP_STYLE,
              position: "fixed",
              left: tooltip.pos.x,
              top: tooltip.pos.y,
              transform: "translate(-50%, calc(-100% - 10px))",
              visibility: "hidden",
              zIndex: 9999,
            }}
          >
            {tooltip.content}
          </div>,
          document.body,
        )}
    </div>
  );
}
