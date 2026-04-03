/**
 * PerspectiveDungeonView
 *
 * A self-contained react-three-fiber Canvas that renders a first-person
 * dungeon view in the style of Eye of the Beholder.
 *
 * The dungeon is tessellated into instanced quads (one InstancedTileMesh per
 * surface type: floors, ceilings, walls).  Only cells within `renderRadius`
 * of the camera are included, and only the faces that border open space are
 * emitted (hidden-surface removal at build time).
 *
 * Props
 * ─────
 * solidData     Uint8Array, 1 byte per cell, row-major (z * width + x).
 *               Value > 0 means solid/wall.
 * width/height  Grid dimensions in cells.
 * cameraX/Z     Camera world position (cell-centre = n + 0.5).
 * yaw           Camera yaw in radians (0 = facing -Z / "north").
 * atlas         TileAtlas describing the tilesheet layout.
 * texture       THREE.Texture pointing at the tilesheet image.
 * floorTile     Tile ID for floor faces.
 * ceilingTile   Tile ID for ceiling faces.
 * wallTile      Tile ID for wall faces.
 * renderRadius   How many cells from the camera to include (default 16).
 * ceilingHeight  World-space height of the ceiling (default 1).  Walls scale
 *                to fill floor→ceiling; camera eye sits at ceilingHeight/2.
 * tileSize       World-space width (and depth) of each tile (default 1).
 *                cameraX/Z are in cell units; world positions = cell * tileSize.
 */
import { useMemo, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { InstancedTileMesh, type TileInstance } from "./InstancedTileMesh";
import type { TileAtlas } from "./tileAtlas";
import type { ObjectPlacement, MobilePlacement } from "../content";
import {
  TORCH_UNIFORMS_GLSL,
  TORCH_HASH_GLSL,
  TORCH_FNS_GLSL,
  makeTorchUniforms,
} from "./torchLighting";

// ---------------------------------------------------------------------------
// Speech bubble type (exported so App can build the array)
// ---------------------------------------------------------------------------

export type SpeechBubbleData = {
  id: string;
  x: number; // cell coordinate
  z: number; // cell coordinate
  text: string;
  speakerName?: string;
  inverted?: boolean; // when true, renders below the speaker (tail points up)
};

// ---------------------------------------------------------------------------
// Damage number type (exported so callers can build the array)
// ---------------------------------------------------------------------------

export type DamageNumberData = {
  id: string;
  x: number; // cell coordinate of the hit target
  z: number; // cell coordinate of the hit target
  amount: number; // damage dealt
  spawnedAt: number; // Date.now() when the damage occurred
};

// ---------------------------------------------------------------------------
// SpeechBubbleSprite — renders a single speech bubble via drei Html
// ---------------------------------------------------------------------------

function SpeechBubbleSprite({
  bubble,
  tileSize = 1,
  ceilingHeight = 1.5,
  fogNear = 4,
  fogFar = 28,
}: {
  bubble: SpeechBubbleData;
  tileSize?: number;
  ceilingHeight?: number;
  fogNear?: number;
  fogFar?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const divRef = useRef<HTMLDivElement>(null);

  // Character-by-character typewriter animation
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(bubble.text.slice(0, i));
      if (i >= bubble.text.length) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [bubble.text]);

  const wx = (bubble.x + 0.5) * tileSize;
  // Normal: above the sprite; inverted: below floor so it appears at screen bottom near speaker
  const wy = bubble.inverted ? -0.5 : ceilingHeight + 0.5;
  const wz = (bubble.z + 0.5) * tileSize;

  // Update opacity each frame based on distance — fades like fog, min 0.35 so
  // it stays legible even when the speaker is deep in shadow / behind geometry.
  useFrame(({ camera }) => {
    if (!divRef.current) return;
    const dx = camera.position.x - wx;
    const dz = camera.position.z - wz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const t = Math.max(
      0,
      Math.min(1, (dist - fogNear) / Math.max(1, fogFar - fogNear)),
    );
    const opacity = Math.max(0.35, 1.0 - t * 0.65);
    divRef.current.style.opacity = String(opacity);
  });

  return (
    <Html
      position={[wx, wy, wz]}
      center
      distanceFactor={tileSize * 4}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        ref={divRef}
        style={{
          position: "relative",
          background: "rgba(6, 4, 18, 0.90)",
          border: "1.5px solid rgba(200, 185, 110, 0.75)",
          borderRadius: 8,
          padding: "6px 10px",
          maxWidth: 320,
          minWidth: 200,
          fontSize: 12,
          color: "#f2e6b8",
          fontFamily: "monospace",
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          textAlign: "left",
          filter: "drop-shadow(0 0 6px rgba(0,0,0,0.95))",
          transition: "opacity 0.25s ease",
        }}
      >
        {bubble.speakerName && (
          <div
            style={{
              fontSize: 10,
              color: "#88aaff",
              marginBottom: 3,
              fontWeight: "bold",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {bubble.speakerName}
          </div>
        )}
        {displayed}
        {/* Tail border (outline colour) */}
        <div
          style={{
            position: "absolute",
            ...(bubble.inverted
              ? {
                  top: -10,
                  borderBottom: "10px solid rgba(200, 185, 110, 0.75)",
                }
              : {
                  bottom: -10,
                  borderTop: "10px solid rgba(200, 185, 110, 0.75)",
                }),
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
          }}
        />
        {/* Tail fill (bubble background colour) */}
        <div
          style={{
            position: "absolute",
            ...(bubble.inverted
              ? { top: -8, borderBottom: "8.5px solid rgba(6, 4, 18, 0.90)" }
              : { bottom: -8, borderTop: "8.5px solid rgba(6, 4, 18, 0.90)" }),
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "5.5px solid transparent",
            borderRight: "5.5px solid transparent",
          }}
        />
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// DamageNumberSprite — floating damage text that drifts up and fades
// ---------------------------------------------------------------------------

const DAMAGE_NUMBER_DURATION_MS = 1500;

function DamageNumberSprite({
  data,
  tileSize = 1,
  ceilingHeight = 1.5,
}: {
  data: DamageNumberData;
  tileSize?: number;
  ceilingHeight?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const wx = (data.x + 0.5) * tileSize;
  const wy = ceilingHeight * 0.85;
  const wz = (data.z + 0.5) * tileSize;

  useFrame(() => {
    if (!divRef.current) return;
    const elapsed = (Date.now() - data.spawnedAt) / DAMAGE_NUMBER_DURATION_MS;
    const t = Math.min(1, elapsed);
    const offsetY = Math.round(t * 60);
    const opacity = 1 - t * t;
    divRef.current.style.transform = `translateX(-50%) translateY(-${offsetY}px)`;
    divRef.current.style.opacity = String(opacity);
  });

  return (
    <Html position={[wx, wy, wz]} style={{ pointerEvents: "none", userSelect: "none" }}>
      <div
        ref={divRef}
        style={{
          color: "#ff4444",
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: 18,
          textShadow: "0 0 4px #000, 0 0 8px #000",
          whiteSpace: "nowrap",
          willChange: "transform, opacity",
        }}
      >
        -{data.amount}
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Object registry
// ---------------------------------------------------------------------------

export type ObjectFactory = () => THREE.Object3D;
export type ObjectRegistry = Record<string, ObjectFactory>;

// ---------------------------------------------------------------------------
// Sprite atlas for mobiles
// ---------------------------------------------------------------------------

export type SpriteAtlas = {
  texture: THREE.Texture;
  columns: number;
  rows: number;
};

// ---------------------------------------------------------------------------
// SceneObjects — renders placed objects via factory registry
// ---------------------------------------------------------------------------

function SceneObjects({
  registry,
  placements,
  tileSize = 1,
  fogNear,
  fogFar,
  fogColor,
  occupiedKeys,
  tintColors,
  torchColor,
  torchIntensity,
}: {
  registry: ObjectRegistry;
  placements: ObjectPlacement[];
  tileSize?: number;
  fogNear?: number;
  fogFar?: number;
  fogColor?: THREE.Color;
  occupiedKeys?: Set<string>;
  tintColors?: THREE.Color[];
  torchColor?: THREE.Color;
  torchIntensity?: number;
}) {
  const objects = useMemo(() => {
    return placements.map((p) => {
      const factory = registry[p.type];
      if (!factory) return null;
      const obj = factory();
      const wx = (p.x + 0.5 + (p.offsetX ?? 0)) * tileSize;
      const wy = p.offsetY ?? 0;
      const wz = (p.z + 0.5 + (p.offsetZ ?? 0)) * tileSize;
      obj.position.set(wx, wy, wz);
      const baseYaw = p.yaw ?? 0;
      obj.rotation.set(0, baseYaw, 0);
      if (p.scale !== undefined) obj.scale.setScalar(p.scale);
      // Initialise fog uniforms on any ShaderMaterials in this object.
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          if (!(mat instanceof THREE.ShaderMaterial)) continue;
          if (mat.uniforms.uFogNear) mat.uniforms.uFogNear.value = fogNear ?? 4;
          if (mat.uniforms.uFogFar) mat.uniforms.uFogFar.value = fogFar ?? 10;
          if (mat.uniforms.uFogColor && fogColor)
            mat.uniforms.uFogColor.value = fogColor;
          if (mat.uniforms.uTint0 && tintColors?.[0])
            mat.uniforms.uTint0.value = tintColors[0];
          if (mat.uniforms.uTint1 && tintColors?.[1])
            mat.uniforms.uTint1.value = tintColors[1];
          if (mat.uniforms.uTint2 && tintColors?.[2])
            mat.uniforms.uTint2.value = tintColors[2];
          if (mat.uniforms.uTint3 && tintColors?.[3])
            mat.uniforms.uTint3.value = tintColors[3];
          if (mat.uniforms.uTorchColor && torchColor)
            mat.uniforms.uTorchColor.value = torchColor;
        }
      });
      return obj;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, placements, tileSize]);

  // Reactively update tint uniforms on all ShaderMaterials when tintColors changes.
  useEffect(() => {
    if (!tintColors) return;
    for (const obj of objects) {
      if (!obj) continue;
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          if (!(mat instanceof THREE.ShaderMaterial)) continue;
          if (mat.uniforms.uTint0 && tintColors[0])
            mat.uniforms.uTint0.value = tintColors[0];
          if (mat.uniforms.uTint1 && tintColors[1])
            mat.uniforms.uTint1.value = tintColors[1];
          if (mat.uniforms.uTint2 && tintColors[2])
            mat.uniforms.uTint2.value = tintColors[2];
          if (mat.uniforms.uTint3 && tintColors[3])
            mat.uniforms.uTint3.value = tintColors[3];
        }
      });
    }
  }, [tintColors, objects]);

  useEffect(() => {
    if (!torchColor) return;
    for (const obj of objects) {
      if (!obj) continue;
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          if (mat instanceof THREE.ShaderMaterial && mat.uniforms.uTorchColor)
            mat.uniforms.uTorchColor.value = torchColor;
        }
      });
    }
  }, [torchColor, objects]);

  useEffect(() => {
    if (torchIntensity === undefined) return;
    for (const obj of objects) {
      if (!obj) continue;
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          if (
            mat instanceof THREE.ShaderMaterial &&
            mat.uniforms.uTorchIntensity
          )
            mat.uniforms.uTorchIntensity.value = torchIntensity;
        }
      });
    }
  }, [torchIntensity, objects]);

  // Update uTime each frame on all ShaderMaterials.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (!obj) continue;

      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          if (mat instanceof THREE.ShaderMaterial && mat.uniforms.uTime) {
            mat.uniforms.uTime.value = t;
          }
        }
      });
    }
  });

  return (
    <>
      {objects.map((obj, i) =>
        obj ? <primitive key={i} object={obj} /> : null,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SceneMobiles — renders billboard sprites via InstancedMesh
// ---------------------------------------------------------------------------

const MOBILE_VERT = /* glsl */ `
attribute float aTileId;
attribute float aIsDamaged;    // 1.0 while taking a damage flash
attribute vec4  aUvRectBody;   // x, y, w, h in normalized texture space
attribute vec4  aUvRectHead;   // x, y, w, h in normalized texture space
attribute float aUnconscious;  // 1.0 if unconscious, else 0.0
varying vec2  vUv;
varying float vTileId;
varying float vFogDist;
varying vec2  vWorldPos;
varying float vIsDamaged;
varying vec4  vUvRectBody;
varying vec4  vUvRectHead;
varying float vUnconscious;

void main() {
  vUv = uv;
  vTileId = aTileId;
  vIsDamaged = aIsDamaged;
  vUvRectBody = aUvRectBody;
  vUvRectHead = aUvRectHead;
  vUnconscious = aUnconscious;
  vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xz;
  vec4 eyePos = viewMatrix * worldPos;
  vFogDist = length(eyePos.xyz);
  gl_Position = projectionMatrix * eyePos;
}
`;

const MOBILE_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uColumns;
uniform float uRows;
uniform vec3  uFogColor;
${TORCH_UNIFORMS_GLSL}
varying vec2  vUv;
varying float vTileId;
varying float vFogDist;
varying vec2  vWorldPos;
varying float vIsDamaged;    // 1.0 while this mobile is taking damage (per-instance)
varying vec4  vUvRectBody;
varying vec4  vUvRectHead;
varying float vUnconscious;

${TORCH_HASH_GLSL}
${TORCH_FNS_GLSL}

void main() {
  // Sample body layer. Use explicit UV rect when provided (w > 0), otherwise
  // derive from tileId.
  vec2 bodyMin, bodySize;
  if (vUvRectBody.z > 0.0) {
    bodyMin  = vUvRectBody.xy;
    bodySize = vUvRectBody.zw;
  } else {
    float col = mod(vTileId, uColumns);
    float row = floor(vTileId / uColumns);
    bodyMin  = vec2(col / uColumns, 1.0 - (row + 1.0) / uRows);
    bodySize = vec2(1.0 / uColumns, 1.0 / uRows);
  }
  vec4 bodyColor = texture2D(uAtlas, bodyMin + vUv * bodySize);

  // Sample head layer on top of body, with optional bobbing animation.
  vec4 headColor = vec4(0.0);
  if (vUvRectHead.z > 0.0) {
    float bob = (vUnconscious < 0.5) ? abs(sin(uTime * 1.53)) * 0.0024 : 0.0;
    vec2 headUv = vec2(
      vUvRectHead.x + vUv.x * vUvRectHead.z,
      vUvRectHead.y + vUv.y * vUvRectHead.w + bob + 0.0025
    );
    headColor = texture2D(uAtlas, headUv);
  }

  // Composite: head on top of body.
  vec4 color;
  if (headColor.a >= 0.5) {
    color = headColor;
  } else if (bodyColor.a >= 0.5) {
    color = bodyColor;
  } else {
    discard;
  }

  float band = torchBand(0.03);
  vec3 lit = applyTorchLighting(color.rgb, band);

  // White damage flash — alternate between lit colour and white at ~8 Hz
  float flashOn = step(0.5, fract(uTime * 8.0));
  lit = mix(lit, vec3(1.0, 1.0, 1.0), vIsDamaged * flashOn);
  gl_FragColor = vec4(mix(lit, uFogColor, step(4.0, band)), color.a);
}`;

// Reusable temporaries to avoid per-frame allocation.
const _mbMat4 = new THREE.Matrix4();
const _mbPos = new THREE.Vector3();
const _mbQuat = new THREE.Quaternion();
const _mbScale = new THREE.Vector3();
const _mbEuler = new THREE.Euler();

function SceneMobiles({
  placements,
  atlas,
  tileSize = 1,
  ceilingHeight = 1.5,
  fogNear = 4,
  fogFar = 10,
  fogColor,
  flash,
  attackDirs,
  tintColors,
  torchColor,
  torchIntensity,
}: {
  placements: MobilePlacement[];
  atlas: SpriteAtlas;
  tileSize?: number;
  ceilingHeight?: number;
  fogNear?: number;
  fogFar?: number;
  fogColor?: THREE.Color;
  flash?: boolean[];
  /** Per-mobile attack direction for lunge animation (null = not attacking). */
  attackDirs?: Array<{ dx: number; dz: number } | null>;
  tintColors?: THREE.Color[];
  torchColor?: THREE.Color;
  torchIntensity?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const isDamagedRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const attackStartRef = useRef<Map<number, number>>(new Map());
  const count = placements.length;

  const { geo, mat } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);

    const tileIds = new Float32Array(count);
    const uvRectBodies = new Float32Array(count * 4);
    const uvRectHeads = new Float32Array(count * 4);
    const unconsciousArr = new Float32Array(count);
    placements.forEach((p, i) => {
      tileIds[i] = p.tileId;
      if (p.uvRectBody) {
        uvRectBodies[i * 4] = p.uvRectBody[0];
        uvRectBodies[i * 4 + 1] = p.uvRectBody[1];
        uvRectBodies[i * 4 + 2] = p.uvRectBody[2];
        uvRectBodies[i * 4 + 3] = p.uvRectBody[3];
      }
      if (p.uvRectHead) {
        uvRectHeads[i * 4] = p.uvRectHead[0];
        uvRectHeads[i * 4 + 1] = p.uvRectHead[1];
        uvRectHeads[i * 4 + 2] = p.uvRectHead[2];
        uvRectHeads[i * 4 + 3] = p.uvRectHead[3];
      }
      unconsciousArr[i] = p.unconscious ? 1.0 : 0.0;
      // When rects are absent the values stay 0; body shader falls back to tileId.
    });
    geo.setAttribute("aTileId", new THREE.InstancedBufferAttribute(tileIds, 1));
    geo.setAttribute(
      "aUvRectBody",
      new THREE.InstancedBufferAttribute(uvRectBodies, 4),
    );
    geo.setAttribute(
      "aUvRectHead",
      new THREE.InstancedBufferAttribute(uvRectHeads, 4),
    );
    geo.setAttribute(
      "aUnconscious",
      new THREE.InstancedBufferAttribute(unconsciousArr, 1),
    );

    const isDamagedArr = new Float32Array(count);
    const isDamagedAttr = new THREE.InstancedBufferAttribute(isDamagedArr, 1);
    geo.setAttribute("aIsDamaged", isDamagedAttr);
    isDamagedRef.current = isDamagedAttr;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlas.texture },
        uColumns: { value: atlas.columns },
        uRows: { value: atlas.rows },
        uFogColor: { value: fogColor ?? new THREE.Color(0, 0, 0) },
        uFogNear: { value: fogNear },
        uFogFar: { value: fogFar },
        uTime: { value: 0 },
        ...makeTorchUniforms(tintColors),
      },
      vertexShader: MOBILE_VERT,
      fragmentShader: MOBILE_FRAG,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });

    return { geo, mat };
  }, [placements, atlas, count, fogNear, fogFar, fogColor]);

  useEffect(() => {
    if (tintColors?.[0]) mat.uniforms.uTint0.value = tintColors[0];
    if (tintColors?.[1]) mat.uniforms.uTint1.value = tintColors[1];
    if (tintColors?.[2]) mat.uniforms.uTint2.value = tintColors[2];
    if (tintColors?.[3]) mat.uniforms.uTint3.value = tintColors[3];
  }, [tintColors, mat]);

  useEffect(() => {
    if (torchColor) mat.uniforms.uTorchColor.value = torchColor;
  }, [torchColor, mat]);

  useEffect(() => {
    if (torchIntensity !== undefined)
      mat.uniforms.uTorchIntensity.value = torchIntensity;
  }, [torchIntensity, mat]);

  useFrame(({ camera, clock }) => {
    if (!meshRef.current || count === 0) return;
    mat.uniforms.uTime.value = clock.getElapsedTime();

    // Update per-instance damage flash
    if (isDamagedRef.current && flash) {
      const arr = isDamagedRef.current.array as Float32Array;
      let changed = false;
      for (let i = 0; i < count; i++) {
        const v = flash[i] ? 1.0 : 0.0;
        if (arr[i] !== v) {
          arr[i] = v;
          changed = true;
        }
      }
      if (changed) isDamagedRef.current.needsUpdate = true;
    }

    const camPos = camera.position;
    const now = Date.now();
    const LUNGE_DURATION_MS = 450;

    placements.forEach((p, i) => {
      const [geomW, geomH] = p.geometrySize ?? [1, 1];
      let wx = (p.x + 0.5) * tileSize;
      let wz = (p.z + 0.5) * tileSize;

      // Attack lunge animation: sine-curve offset toward the attack target
      const dir = attackDirs?.[i];
      if (dir) {
        if (!attackStartRef.current.has(i)) {
          attackStartRef.current.set(i, now);
        }
        const elapsed = now - attackStartRef.current.get(i)!;
        if (elapsed < LUNGE_DURATION_MS) {
          const progress = elapsed / LUNGE_DURATION_MS;
          const lunge = Math.sin(progress * Math.PI) * 0.45 * tileSize;
          wx += dir.dx * lunge;
          wz += dir.dz * lunge;
        }
      } else {
        attackStartRef.current.delete(i);
      }

      // Centre the billboard vertically within its cell height.
      const wy = (geomH * tileSize) / 2;
      _mbPos.set(wx, wy, wz);
      _mbScale.set(geomW * tileSize, geomH * tileSize, 1);
      const angle = Math.atan2(camPos.x - wx, camPos.z - wz);
      _mbEuler.set(0, angle, 0);
      _mbQuat.setFromEuler(_mbEuler);
      _mbMat4.compose(_mbPos, _mbQuat, _mbScale);
      meshRef.current!.setMatrixAt(i, _mbMat4);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;

  return <instancedMesh ref={meshRef} args={[geo, mat, count]} />;
}

// ---------------------------------------------------------------------------
// Face geometry helpers
// ---------------------------------------------------------------------------

const _q = new THREE.Quaternion();

const CAMERA_Y_FACTOR = 0.5;

function faceMatrix(
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number,
  scaleY = 1,
  scaleX = 1,
): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  _q.setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ"));
  m.compose(
    new THREE.Vector3(px, py, pz),
    _q,
    new THREE.Vector3(scaleX, scaleY, 1),
  );
  return m;
}

// PlaneGeometry default normal is +Z.  These rotations point each face type
// toward open space so it is visible from inside the dungeon.
//
//   floor    → normal +Y : Euler(-π/2, 0, 0)
//   ceiling  → normal -Y : Euler(+π/2, 0, 0)
//   north wall (at z=cz)    → normal +Z (into cell) : Euler(0,0,0)
//   south wall (at z=cz+1)  → normal -Z (into cell) : Euler(0,π,0)
//   west wall  (at x=cx)    → normal +X (into cell) : Euler(0,π/2,0)
//   east wall  (at x=cx+1)  → normal -X (into cell) : Euler(0,-π/2,0)

const HALF_PI = Math.PI / 2;

function buildFaceInstances(
  solidData: Uint8Array,
  width: number,
  height: number,
  camX: number,
  camZ: number,
  radius: number,
  floorTile: number,
  ceilTile: number,
  wallTile: number,
  ceilingHeight: number,
  tileSize: number,
  floorData?: Uint8Array,
  wallData?: Uint8Array,
  floorTileMap?: number[],
  wallTileMap?: number[],
  ceilingData?: Uint8Array,
  ceilingTileMap?: number[],
): {
  floors: TileInstance[];
  ceilings: TileInstance[];
  walls: TileInstance[];
} {
  const floors: TileInstance[] = [];
  const ceilings: TileInstance[] = [];
  const walls: TileInstance[] = [];

  const minCX = Math.max(0, Math.floor(camX - radius));
  const maxCX = Math.min(width - 1, Math.floor(camX + radius));
  const minCZ = Math.max(0, Math.floor(camZ - radius));
  const maxCZ = Math.min(height - 1, Math.floor(camZ + radius));

  const r2 = radius * radius;

  function solid(cx: number, cz: number): boolean {
    if (cx < 0 || cz < 0 || cx >= width || cz >= height) return true;
    return solidData[cz * width + cx] > 0;
  }

  for (let cz = minCZ; cz <= maxCZ; cz++) {
    for (let cx = minCX; cx <= maxCX; cx++) {
      if (solid(cx, cz)) continue;

      // Range check (circular)
      const dx = cx + 0.5 - camX;
      const dz = cz + 0.5 - camZ;
      if (dx * dx + dz * dz > r2) continue;

      const wx = (cx + 0.5) * tileSize;
      const wz = (cz + 0.5) * tileSize;

      const wallMidY = ceilingHeight / 2;

      // Floor & ceiling always
      const cellFloorType = floorData ? floorData[cz * width + cx] : 0;
      const resolvedFloorTile =
        floorData && floorTileMap && cellFloorType > 0
          ? (floorTileMap[cellFloorType] ?? floorTile)
          : floorTile;
      floors.push({
        matrix: faceMatrix(wx, 0, wz, -HALF_PI, 0, 0, tileSize, tileSize),
        tileId: resolvedFloorTile,
        cellX: cx,
        cellZ: cz,
      });
      const cellCeilingType = ceilingData ? ceilingData[cz * width + cx] : 0;
      const resolvedCeilingTile =
        ceilingData && ceilingTileMap && cellCeilingType > 0
          ? (ceilingTileMap[cellCeilingType] ?? ceilTile)
          : ceilTile;
      ceilings.push({
        matrix: faceMatrix(
          wx,
          ceilingHeight,
          wz,
          HALF_PI,
          0,
          0,
          tileSize,
          tileSize,
        ),
        tileId: resolvedCeilingTile,
      });

      // Wall faces: emit only where neighbour is solid.
      // cellX/cellZ on wall instances point to the solid neighbour cell so that
      // per-cell data (passage tint, etc.) can be looked up for that solid cell.

      function resolveWallTile(wcx: number, wcz: number): number {
        if (!wallData || !wallTileMap) return wallTile;
        const wt = wallData[wcz * width + wcx];
        return wt > 0 ? (wallTileMap[wt] ?? wallTile) : wallTile;
      }

      // North wall: between this cell (cz) and cell (cz-1). Face at z=cz, normal +Z.
      if (solid(cx, cz - 1))
        walls.push({
          matrix: faceMatrix(
            wx,
            wallMidY,
            cz * tileSize,
            0,
            0,
            0,
            ceilingHeight,
            tileSize,
          ),
          tileId: resolveWallTile(cx, cz - 1),
          cellX: cx,
          cellZ: cz - 1,
        });

      // South wall: at z=cz+1, normal -Z.
      if (solid(cx, cz + 1))
        walls.push({
          matrix: faceMatrix(
            wx,
            wallMidY,
            (cz + 1) * tileSize,
            0,
            Math.PI,
            0,
            ceilingHeight,
            tileSize,
          ),
          tileId: resolveWallTile(cx, cz + 1),
          cellX: cx,
          cellZ: cz + 1,
        });

      // West wall: at x=cx, normal +X.
      if (solid(cx - 1, cz))
        walls.push({
          matrix: faceMatrix(
            cx * tileSize,
            wallMidY,
            wz,
            0,
            HALF_PI,
            0,
            ceilingHeight,
            tileSize,
          ),
          tileId: resolveWallTile(cx - 1, cz),
          cellX: cx - 1,
          cellZ: cz,
        });

      // East wall: at x=cx+1, normal -X.
      if (solid(cx + 1, cz))
        walls.push({
          matrix: faceMatrix(
            (cx + 1) * tileSize,
            wallMidY,
            wz,
            0,
            -HALF_PI,
            0,
            ceilingHeight,
            tileSize,
          ),
          tileId: resolveWallTile(cx + 1, cz),
          cellX: cx + 1,
          cellZ: cz,
        });
    }
  }

  return { floors, ceilings, walls };
}

// ---------------------------------------------------------------------------
// Inner scene (runs inside Canvas, can use R3F hooks)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Background sphere — shown when camera is inside a wall (ghost mode)
// ---------------------------------------------------------------------------

// Bone icon UV in the 256×256 icons.png sheet (tileSize=32, bone at pixel [224,64])
const BONE_UV = {
  x: 224 / 256,
  y: (256 - 64 - 32) / 256, // flip to WebGL bottom-origin
  w: 32 / 256,
  h: 32 / 256,
};

function BackgroundSphere({
  atlas,
  texture,
  floorTile,
  boneTexture,
  boneTileUv,
}: {
  atlas: TileAtlas;
  texture: THREE.Texture;
  floorTile: number;
  boneTexture?: THREE.Texture;
  boneTileUv?: { x: number; y: number; w: number; h: number };
}) {
  const tile = atlas.getTile(floorTile);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    meshRef.current?.position.copy(camera.position);
  });

  const mat = useMemo(() => {
    const hasBones = !!(boneTexture && boneTileUv);
    return new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: texture },
        uTileOffset: { value: new THREE.Vector2(tile.uvX, tile.uvY) },
        uTileSize: { value: new THREE.Vector2(tile.uvW, tile.uvH) },
        uRepeat: { value: new THREE.Vector2(12, 6) },
        uBoneAtlas: { value: boneTexture ?? null },
        uBoneOffset: {
          value: new THREE.Vector2(boneTileUv?.x ?? 0, boneTileUv?.y ?? 0),
        },
        uBoneSize: {
          value: new THREE.Vector2(boneTileUv?.w ?? 0, boneTileUv?.h ?? 0),
        },
        uHasBones: { value: hasBones ? 1 : 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        uniform vec2 uTileOffset;
        uniform vec2 uTileSize;
        uniform vec2 uRepeat;
        uniform sampler2D uBoneAtlas;
        uniform vec2 uBoneOffset;
        uniform vec2 uBoneSize;
        uniform int uHasBones;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        #define PI 3.14159265

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          // Tiled dirt background
          vec2 tiled = fract(vUv * uRepeat);
          vec2 atlasUv = uTileOffset + tiled * uTileSize;
          vec4 col = texture2D(uAtlas, atlasUv);

          // Sparse bone scatter using spherical coords from 3-D position
          // (avoids UV seam / pole compression artifacts)
          if (uHasBones == 1) {
            vec3 n = vWorldPos;
            float phi = atan(n.z, n.x);            // -PI .. PI
            float theta = acos(clamp(n.y, -1.0, 1.0)); // 0 .. PI
            vec2 sphereUv = vec2(phi / (2.0 * PI) + 0.5, theta / PI);

            vec2 boneGridSize = vec2(10.0, 6.0);
            vec2 cellId = floor(sphereUv * boneGridSize);
            vec2 cellUv = fract(sphereUv * boneGridSize);

            float presence = hash(cellId);
            if (presence < 0.18) {
              vec2 center = vec2(
                mix(0.2, 0.8, hash(cellId + vec2(3.7, 0.0))),
                mix(0.2, 0.8, hash(cellId + vec2(0.0, 5.3)))
              );
              float rotIdx = floor(hash(cellId + vec2(11.1, 2.3)) * 4.0);
              vec2 d = cellUv - center;
              if (rotIdx < 1.0) { /* 0 deg */ }
              else if (rotIdx < 2.0) { d = vec2(-d.y,  d.x); }
              else if (rotIdx < 3.0) { d = -d; }
              else                   { d = vec2( d.y, -d.x); }

              float boneHalf = 0.28;
              vec2 boneUv = d / (boneHalf * 2.0) + 0.5;
              if (boneUv.x >= 0.0 && boneUv.x <= 1.0 &&
                  boneUv.y >= 0.0 && boneUv.y <= 1.0) {
                vec4 bone = texture2D(uBoneAtlas, uBoneOffset + boneUv * uBoneSize);
                col = mix(col, bone, bone.a);
              }
            }
          }

          gl_FragColor = col;
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, tile.uvX, tile.uvY, tile.uvW, tile.uvH, boneTexture, boneTileUv]);

  return (
    <mesh ref={meshRef} renderOrder={-1}>
      <sphereGeometry args={[60, 32, 24]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

type SceneProps = {
  solidData: Uint8Array;
  width: number;
  height: number;
  cameraX: number;
  cameraZ: number;
  yaw: number;
  atlas: TileAtlas;
  texture: THREE.Texture;
  floorTile: number;
  ceilingTile: number;
  wallTile: number;
  renderRadius: number;
  ceilingHeight?: number;
  tileSize?: number;
  fogNear?: number;
  fogFar?: number;
  fogColor?: string;
  fov?: number;
  debugEdges?: boolean;
  /** Static placed objects resolved via objectRegistry. */
  objects?: ObjectPlacement[];
  objectRegistry?: ObjectRegistry;
  /** Occupied cell keys ("x_z") — objects whose type is "door" will animate open. */
  objectOccupiedKeys?: Set<string>;
  /** Billboard sprite mobiles. */
  mobiles?: MobilePlacement[];
  spriteAtlas?: SpriteAtlas;
  /** Separate atlas used for mobiles whose type === "adventurer". Falls back to spriteAtlas. */
  adventurerSpriteAtlas?: SpriteAtlas;
  /** Per-mobile damage flash state (parallel array to mobiles: mobs first, then alive advs). */
  mobileFlash?: boolean[];
  /** Per-mobile attack lunge direction (parallel array to mobiles). */
  mobileAttackDirs?: Array<{ dx: number; dz: number } | null>;
  /** Floating damage numbers to render above hit entities. */
  damageNumbers?: DamageNumberData[];
  /** Per-cell highlight mask: 0=none, 1=targeting preview, 2=fire, 3=lightning. */
  highlightMask?: Uint8Array;
  /** Per-cell passage mask: 0=none, 1=disabled, 2=enabled. Applied to wall faces. */
  passageMask?: Uint8Array;
  /** Tile IDs for passage overlays: [untoggled, toggled, open-door]. */
  passageOverlayIds?: [number, number, number];
  /** Per-cell hazard mask passed to the floor mesh for overlay rendering. */
  hazardData?: Uint8Array;
  /** Tile ID for the floor hazard overlay tile (e.g. trap-grid plate). */
  hazardOverlayId?: number;
  /** Active speech bubbles to render above speakers in 3-D space. */
  speechBubbles?: SpeechBubbleData[];
  /** Four torchlight tint band colours as CSS hex strings (bands 0–3, near→far). */
  tintColors?: string[];
  /** Additive torch colour as a CSS hex string. */
  torchColor?: string;
  /** Intensity multiplier for the additive torch (0–2, default 1). */
  torchIntensity?: number;
  /** Per-cell floor type IDs (from atlas floorTypes). Used with floorTileMap. */
  floorData?: Uint8Array;
  /** Per-cell wall type IDs (from atlas wallTypes). Used with wallTileMap. */
  wallData?: Uint8Array;
  /** Maps atlas floorType id → row-major tile ID. Index 0 = fallback to floorTile. */
  floorTileMap?: number[];
  /** Maps atlas wallType id → row-major tile ID. Index 0 = fallback to wallTile. */
  wallTileMap?: number[];
  /** Per-cell ceiling type IDs (from atlas ceilingTypes). Used with ceilingTileMap. */
  ceilingData?: Uint8Array;
  /** Maps atlas ceilingType id → row-major tile ID. Index 0 = fallback to ceilingTile. */
  ceilingTileMap?: number[];
  /** Tile ID used for the background sphere (visible inside walls). Defaults to floorTile. */
  backgroundTile?: number;
  /** Optional icons texture for scattering bone decorations on the background sphere. */
  boneTexture?: THREE.Texture;
};

function DungeonScene({
  solidData,
  width,
  height,
  cameraX,
  cameraZ,
  yaw,
  atlas,
  texture,
  floorTile,
  ceilingTile,
  wallTile,
  renderRadius,
  ceilingHeight = 1.5,
  tileSize = 1,
  fov = 75,
  fogNear,
  fogFar,
  fogColor,
  debugEdges,
  objects,
  objectRegistry,
  objectOccupiedKeys,
  mobiles,
  spriteAtlas,
  adventurerSpriteAtlas,
  mobileFlash,
  mobileAttackDirs,
  damageNumbers,
  highlightMask,
  passageMask,
  passageOverlayIds,
  hazardData,
  hazardOverlayId,
  speechBubbles,
  tintColors,
  torchColor,
  torchIntensity,
  floorData,
  wallData,
  floorTileMap,
  wallTileMap,
  ceilingData,
  ceilingTileMap,
  backgroundTile,
  boneTexture,
}: SceneProps) {
  const fogColorObj = useMemo(
    () => (fogColor ? new THREE.Color(fogColor) : undefined),
    [fogColor],
  );
  const tintColorObjs = useMemo(
    () => tintColors?.map((c) => new THREE.Color(c)),
    [tintColors],
  );
  const torchColorObj = useMemo(
    () => (torchColor ? new THREE.Color(torchColor) : undefined),
    [torchColor],
  );
  const { camera } = useThree();

  // Snap to integer cell to avoid rebuilding every sub-cell movement
  const cellX = Math.floor(cameraX);
  const cellZ = Math.floor(cameraZ);

  const { floors, ceilings, walls } = useMemo(
    () =>
      buildFaceInstances(
        solidData,
        width,
        height,
        cellX + 0.5,
        cellZ + 0.5,
        renderRadius,
        floorTile,
        ceilingTile,
        wallTile,
        ceilingHeight,
        tileSize,
        floorData,
        wallData,
        floorTileMap,
        wallTileMap,
        ceilingData,
        ceilingTileMap,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      solidData,
      width,
      height,
      cellX,
      cellZ,
      renderRadius,
      floorTile,
      ceilingTile,
      wallTile,
      ceilingHeight,
      tileSize,
      floorData,
      wallData,
      floorTileMap,
      wallTileMap,
      ceilingData,
      ceilingTileMap,
    ],
  );

  // Stable splits so that SceneMobiles' geometry useMemo only rebuilds when
  // mobiles content changes — not on every render caused by flash/attackDirs updates.
  const nonAdvs = useMemo(
    () => mobiles?.filter((p) => p.type !== "adventurer") ?? [],
    [mobiles],
  );
  const advs = useMemo(
    () => mobiles?.filter((p) => p.type === "adventurer") ?? [],
    [mobiles],
  );
  const advAtlas = adventurerSpriteAtlas ?? spriteAtlas;

  // Update camera every render
  useEffect(() => {
    // Pull camera back to the rear of the cell (0.5 units opposite facing direction).
    // Forward = (-sin(yaw), 0, -cos(yaw)), so back = (+sin(yaw), 0, +cos(yaw)).
    camera.position.set(
      (cameraX + 0.5 * Math.sin(yaw)) * tileSize,
      ceilingHeight * CAMERA_Y_FACTOR,
      (cameraZ + 0.5 * Math.cos(yaw)) * tileSize,
    );
    (camera as THREE.PerspectiveCamera).fov = fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  });

  useEffect(() => {
    camera.rotation.set(0, yaw, 0, "YXZ");
  });

  return (
    <>
      <BackgroundSphere
        atlas={atlas}
        texture={texture}
        floorTile={backgroundTile ?? floorTile}
        boneTexture={boneTexture}
        boneTileUv={boneTexture ? BONE_UV : undefined}
      />
      {/* Ambient + directional light so tiles aren't pitch-black */}
      <ambientLight intensity={0.6} />
      <pointLight
        position={[cameraX * tileSize, ceilingHeight / 2, cameraZ * tileSize]}
        intensity={4}
        distance={12}
        decay={2}
        color="#ffe8c0"
      />

      <InstancedTileMesh
        instances={floors}
        atlas={atlas}
        texture={texture}
        fogNear={fogNear}
        fogFar={fogFar}
        fogColor={fogColorObj}
        debugEdges={debugEdges}
        highlightData={highlightMask}
        hazardData={hazardData}
        hazardOverlayId={hazardOverlayId}
        gridWidth={width}
        tintColors={tintColorObjs}
        torchColor={torchColorObj}
        torchIntensity={torchIntensity}
      />
      <InstancedTileMesh
        instances={ceilings}
        atlas={atlas}
        texture={texture}
        fogNear={fogNear}
        fogFar={fogFar}
        fogColor={fogColorObj}
        debugEdges={debugEdges}
        tintColors={tintColorObjs}
        torchColor={torchColorObj}
        torchIntensity={torchIntensity}
      />
      <InstancedTileMesh
        instances={walls}
        atlas={atlas}
        texture={texture}
        fogNear={fogNear}
        fogFar={fogFar}
        fogColor={fogColorObj}
        debugEdges={debugEdges}
        passageData={passageMask}
        passageOverlayIds={passageOverlayIds}
        gridWidth={width}
        tintColors={tintColorObjs}
        torchColor={torchColorObj}
        torchIntensity={torchIntensity}
      />

      {objects && objects.length > 0 && objectRegistry && (
        <SceneObjects
          registry={objectRegistry}
          placements={objects}
          tileSize={tileSize}
          fogNear={fogNear}
          fogFar={fogFar}
          fogColor={fogColorObj}
          occupiedKeys={objectOccupiedKeys}
          tintColors={tintColorObjs}
          torchColor={torchColorObj}
          torchIntensity={torchIntensity}
        />
      )}

      {spriteAtlas && nonAdvs.length > 0 && (
        <SceneMobiles
          placements={nonAdvs}
          atlas={spriteAtlas}
          tileSize={tileSize}
          ceilingHeight={ceilingHeight}
          fogNear={fogNear}
          fogFar={fogFar}
          fogColor={fogColorObj}
          flash={mobileFlash?.slice(0, nonAdvs.length)}
          attackDirs={mobileAttackDirs?.slice(0, nonAdvs.length)}
          tintColors={tintColorObjs}
          torchColor={torchColorObj}
          torchIntensity={torchIntensity}
        />
      )}
      {spriteAtlas && advs.length > 0 && (
        <SceneMobiles
          placements={advs}
          atlas={advAtlas}
          tileSize={tileSize}
          ceilingHeight={ceilingHeight}
          fogNear={fogNear}
          fogFar={fogFar}
          fogColor={fogColorObj}
          flash={mobileFlash?.slice(nonAdvs.length)}
          attackDirs={mobileAttackDirs?.slice(nonAdvs.length)}
          tintColors={tintColorObjs}
          torchColor={torchColorObj}
          torchIntensity={torchIntensity}
        />
      )}

      {damageNumbers &&
        damageNumbers.map((d) => (
          <DamageNumberSprite
            key={d.id}
            data={d}
            tileSize={tileSize}
            ceilingHeight={ceilingHeight}
          />
        ))}

      {speechBubbles &&
        speechBubbles.map((b) => (
          <SpeechBubbleSprite
            key={b.id}
            bubble={b}
            tileSize={tileSize}
            ceilingHeight={ceilingHeight}
            fogNear={fogNear ?? 4}
            fogFar={fogFar ?? 28}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export type PerspectiveDungeonViewProps = SceneProps & {
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  // speechBubbles is already part of SceneProps; re-listed here for clarity
};

export function PerspectiveDungeonView({
  className,
  style,
  fov,
  children,
  ...sceneProps
}: PerspectiveDungeonViewProps) {
  return (
    <Canvas
      className={className}
      style={style}
      camera={{ fov: fov, near: 0.05, far: 64 }}
      gl={{ antialias: false }}
    >
      <DungeonScene {...sceneProps} fov={fov} />
      {children}
    </Canvas>
  );
}
