import GhostInventory from "./GhostInventory";
import { Minimap } from "./Minimap";
import styles from "./styles/MinimapSidebar.module.css";

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
  mobs,
  adventurers,
  doorPlacements,
  stovePlacements,
  hazardData,
  disarmedTraps,
  chests,
  furniturePlacements,
  scale,
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
          mobs={mobs}
          adventurers={adventurers}
          doorPlacements={doorPlacements}
          stovePlacements={stovePlacements}
          hazardData={hazardData}
          disarmedTraps={disarmedTraps}
          chests={chests}
          furniturePlacements={furniturePlacements}
          scale={scale}
          className={styles.canvas}
        />
      </div>
      <div className={styles.controls}></div>
      <GhostInventory />
    </div>
  );
}
