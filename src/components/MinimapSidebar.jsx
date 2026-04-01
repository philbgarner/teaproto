import GhostInventory from "./GhostInventory";
import { Minimap } from "./Minimap";
import styles from "./styles/MinimapSidebar.module.css";

/**
 * Right sidebar containing the 3-D minimap and the ghost inventory panel.
 *
 * @param {{
 *   solidData: Uint8Array,
 *   dungeonWidth: number,
 *   dungeonHeight: number,
 *   camera: { x: number, z: number, yaw: number },
 *   texture: import('three').Texture,
 *   atlas: object,
 *   floorTile: number,
 *   floorData?: Uint8Array,
 *   floorTileMap?: number[],
 *   tileSize?: number,
 *   exploredMaskRef?: React.RefObject<Uint8Array|null>,
 * }} props
 */
export function MinimapSidebar({
  solidData,
  dungeonWidth,
  dungeonHeight,
  camera,
  exploredMaskRef,
  texture,
  atlas,
  floorTile,
  floorData,
  floorTileMap,
  tileSize,
}) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.canvasWrap}>
        <Minimap
          solidData={solidData}
          dungeonWidth={dungeonWidth}
          dungeonHeight={dungeonHeight}
          camera={camera}
          texture={texture}
          atlas={atlas}
          floorTile={floorTile}
          floorData={floorData}
          floorTileMap={floorTileMap}
          tileSize={tileSize}
          exploredMaskRef={exploredMaskRef}
          className={styles.canvas}
        />
      </div>
      <div className={styles.controls}></div>
      <GhostInventory />
    </div>
  );
}
