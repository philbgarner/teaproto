import { useEffect, useRef, useState } from "react";
import hotkeys from "hotkeys-js";
import { LERP_DURATION_MS } from "../gameConstants";

export interface CameraState {
  x: number;
  z: number;
  yaw: number;
}

export interface EotBCameraOptions {
  onStep?: () => void;
  onRotation?: () => void;
  blocked?: boolean;
  onBlockedMove?: (dx: number, dz: number) => void;
  canPhaseWalls?: boolean;
  blockedPositions?: { x: number; z: number }[];
  keybindings: {
    moveForward: string[];
    moveBackward: string[];
    strafeLeft: string[];
    strafeRight: string[];
    turnLeft: string[];
    turnRight: string[];
    [key: string]: string[];
  };
  startYaw?: number;
  resetKey?: number;
}

export interface MoveActions {
  moveForward: () => void;
  moveBackward: () => void;
  strafeLeft: () => void;
  strafeRight: () => void;
  turnLeft: () => void;
  turnRight: () => void;
}

export function useEotBCamera(
  solidData: Uint8Array | null,
  width: number,
  height: number,
  startX: number,
  startZ: number,
  {
    onStep,
    onRotation,
    blocked,
    onBlockedMove,
    canPhaseWalls,
    blockedPositions,
    keybindings,
    startYaw = 0,
    resetKey = 0,
  }: EotBCameraOptions,
): {
  camera: CameraState;
  logicalRef: React.MutableRefObject<CameraState>;
  doMove: (dx: number, dz: number) => void;
  moveActions: MoveActions;
} {
  const logicalRef = useRef<CameraState>({
    x: startX,
    z: startZ,
    yaw: startYaw,
  });
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
  const [camera, setCamera] = useState<CameraState>(() => ({
    x: startX,
    z: startZ,
    yaw: startYaw,
  }));
  const [prevStartX, setPrevStartX] = useState(startX);
  const [prevStartZ, setPrevStartZ] = useState(startZ);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const solidRef = useRef(solidData);
  const onStepRef = useRef(onStep);
  const onRotationRef = useRef(onRotation);
  const blockedRef = useRef(blocked);
  const blockedPositionsRef = useRef(blockedPositions ?? []);
  const onBlockedMoveRef = useRef(onBlockedMove);
  const canPhaseWallsRef = useRef(canPhaseWalls ?? false);
  const widthRef = useRef(width);
  const heightRef = useRef(height);

  if (prevStartX !== startX || prevStartZ !== startZ || prevResetKey !== resetKey) {
    setPrevStartX(startX);
    setPrevStartZ(startZ);
    setPrevResetKey(resetKey);
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
  }, [startX, startZ, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { solidRef.current = solidData; }, [solidData]);
  useEffect(() => { onStepRef.current = onStep; }, [onStep]);
  useEffect(() => { onRotationRef.current = onRotation; }, [onRotation]);
  useEffect(() => { blockedRef.current = blocked; }, [blocked]);
  useEffect(() => { onBlockedMoveRef.current = onBlockedMove; }, [onBlockedMove]);
  useEffect(() => { canPhaseWallsRef.current = canPhaseWalls ?? false; }, [canPhaseWalls]);
  useEffect(() => { blockedPositionsRef.current = blockedPositions ?? []; }, [blockedPositions]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { heightRef.current = height; }, [height]);

  // ── Shared movement logic (ref-only, stable across renders) ──────────────

  function walkable(cx: number, cz: number): boolean {
    const w = widthRef.current, h = heightRef.current;
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return false;
    if (canPhaseWallsRef.current) return true;
    if (!solidRef.current) return false;
    if (solidRef.current[cz * w + cx] !== 0) return false;
    return !blockedPositionsRef.current.some((p) => p.x === cx && p.z === cz);
  }

  function beginAnim(toX: number, toZ: number, toYaw: number, isMove: boolean) {
    const { x: fx, z: fz, yaw: fyaw } = logicalRef.current;
    animRef.current = {
      fromX: fx, fromZ: fz, fromYaw: fyaw,
      toX, toZ, toYaw,
      startTime: performance.now(),
      animating: true,
    };
    logicalRef.current = { x: toX, z: toZ, yaw: toYaw };
    if (isMove) onStepRef.current?.();
  }

  function guard() {
    return blockedRef.current || animRef.current.animating;
  }

  const moveActions: MoveActions = {
    moveForward() {
      if (guard()) return;
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)), fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x), gz = Math.floor(z);
      const ngx = gx + fdx, ngz = gz + fdz;
      if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw, true);
      else onBlockedMoveRef.current?.(fdx, fdz);
    },
    moveBackward() {
      if (guard()) return;
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)), fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x), gz = Math.floor(z);
      const ngx = gx - fdx, ngz = gz - fdz;
      if (walkable(ngx, ngz)) beginAnim(ngx + 0.5, ngz + 0.5, yaw, true);
      else onBlockedMoveRef.current?.(-fdx, -fdz);
    },
    strafeLeft() {
      if (guard()) return;
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)), fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x), gz = Math.floor(z);
      const sgx = gx + fdz, sgz = gz - fdx;
      if (walkable(sgx, sgz)) beginAnim(sgx + 0.5, sgz + 0.5, yaw, true);
    },
    strafeRight() {
      if (guard()) return;
      const { x, z, yaw } = logicalRef.current;
      const fdx = Math.round(-Math.sin(yaw)), fdz = Math.round(-Math.cos(yaw));
      const gx = Math.floor(x), gz = Math.floor(z);
      const sgx = gx - fdz, sgz = gz + fdx;
      if (walkable(sgx, sgz)) beginAnim(sgx + 0.5, sgz + 0.5, yaw, true);
    },
    turnLeft() {
      if (guard()) return;
      const { x, z, yaw } = logicalRef.current;
      beginAnim(x, z, yaw + Math.PI / 2, false);
      onRotationRef.current?.();
    },
    turnRight() {
      if (guard()) return;
      const { x, z, yaw } = logicalRef.current;
      beginAnim(x, z, yaw - Math.PI / 2, false);
      onRotationRef.current?.();
    },
  };

  // Store in a ref so the hotkeys effect always calls the latest version
  const moveActionsRef = useRef(moveActions);
  moveActionsRef.current = moveActions;

  useEffect(() => {
    const bindings: [string[], () => void][] = [
      [keybindings.moveForward,  () => moveActionsRef.current.moveForward()],
      [keybindings.moveBackward, () => moveActionsRef.current.moveBackward()],
      [keybindings.strafeLeft,   () => moveActionsRef.current.strafeLeft()],
      [keybindings.strafeRight,  () => moveActionsRef.current.strafeRight()],
      [keybindings.turnLeft,     () => moveActionsRef.current.turnLeft()],
      [keybindings.turnRight,    () => moveActionsRef.current.turnRight()],
    ];
    const handlers: [string[], (e: KeyboardEvent) => void][] = bindings.map(
      ([keys, action]) => [keys, (e: KeyboardEvent) => { e.preventDefault(); action(); }],
    );
    for (const [keys, handler] of handlers) {
      if (keys.length) hotkeys(keys.join(","), handler as any);
    }
    return () => {
      for (const [keys, handler] of handlers) {
        if (keys.length) hotkeys.unbind(keys.join(","), handler as any);
      }
    };
  }, [keybindings]);

  useEffect(() => {
    let rafId: number;
    const tick = (now: number) => {
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

  function doMove(dx: number, dz: number) {
    const { x, z, yaw } = logicalRef.current;
    const toX = x + dx;
    const toZ = z + dz;
    animRef.current = {
      fromX: x, fromZ: z, fromYaw: yaw,
      toX, toZ, toYaw: yaw,
      startTime: performance.now(),
      animating: true,
    };
    logicalRef.current = { x: toX, z: toZ, yaw };
    onStepRef.current?.();
  }

  return { camera, logicalRef, doMove, moveActions };
}
