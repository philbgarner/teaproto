import { useSettings } from "../SettingsContext";
import { Minimap } from "./Minimap";
import styles from "./styles/MinimapSidebar.module.css";
import ghostStyles from "./styles/GhostInventory.module.css";

const RPS_COLORS = {
  poisoned: "#22dd44",
  freezing: "#44aaff",
  bleeding: "#ff3333",
};

const RPS_LABELS = {
  poisoned: "Poisoned",
  freezing: "Frozen",
  bleeding: "Bleeding",
};

function HandSlot({ items, registry, side }) {
  const item = items[0];
  const name = item ? registry.getSlotObjectName(item) : null;
  const count = item ? registry.getSlotQuantity(item) : 0;
  const isEmpty = !name;

  return (
    <button
      className={`${ghostStyles.inventorySlot} ${isEmpty ? ghostStyles.emptySlot : ""}`}
      style={{ maxWidth: "50%" }}
      disabled={isEmpty}
    >
      {!isEmpty ? (
        <>
          <span className={ghostStyles.itemName}>{name}</span>
          {count > 1 && <span className={ghostStyles.itemCount}>×{count}</span>}
        </>
      ) : (
        <span style={{ fontSize: "0.65rem", color: "#5a5450" }}>{side}</span>
      )}
    </button>
  );
}

function HandsRow() {
  const { playerData } = useSettings();
  const { registry, leftHand, rightHand } = playerData.ecsData;

  const leftHandItems =
    leftHand != null
      ? (registry.components.inventory.get(leftHand)?.slots ?? [])
      : [];
  const rightHandItems =
    rightHand != null
      ? (registry.components.inventory.get(rightHand)?.slots ?? [])
      : [];

  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <HandSlot items={leftHandItems} registry={registry} side="left" />
      <HandSlot items={rightHandItems} registry={registry} side="right" />
    </div>
  );
}

function MobEntry({ mob, onSummon, summonDisabled }) {
  const effectLabel =
    mob.rpsEffect && mob.rpsEffect !== "none"
      ? RPS_LABELS[mob.rpsEffect]
      : null;
  const effectColor = mob.rpsEffect ? RPS_COLORS[mob.rpsEffect] : undefined;

  const hpFrac = mob.hp !== undefined && mob.maxHp ? mob.hp / mob.maxHp : null;
  const armorFrac =
    mob.satiation !== undefined && mob.maxSatiation
      ? mob.satiation / mob.maxSatiation
      : null;

  return (
    <div className={styles.mobEntry}>
      <div className={styles.mobNameRow}>
        <span className={styles.mobName}>{mob.name ?? "Monster"}</span>
        <button
          className={styles.summonBtn}
          disabled={summonDisabled}
          onClick={onSummon}
          title={
            summonDisabled ? "Cannot summon here" : "Summon to your location"
          }
        >
          ⊹
        </button>
      </div>
      {effectLabel && (
        <div className={styles.mobRow} style={{ color: effectColor }}>
          {effectLabel}
        </div>
      )}
      {mob.satiation !== undefined && (
        <div className={styles.mobRow}>
          <span style={{ color: "#9a8060" }}>Armor </span>
          <span style={{ color: "#44dddd" }}>{mob.satiation.toFixed(0)}</span>
          {armorFrac !== null && (
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${armorFrac * 100}%`, background: "#44dddd" }}
              />
            </div>
          )}
        </div>
      )}
      {mob.hp !== undefined && mob.maxHp !== undefined && (
        <div className={styles.mobRow}>
          <span style={{ color: "#9a8060" }}>HP </span>
          <span style={{ color: "#ff4444" }}>
            {mob.hp.toFixed(0)}/{mob.maxHp}
          </span>
          {hpFrac !== null && (
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${hpFrac * 100}%`, background: "#ff4444" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  goldDrops,
  itemDrops,
  scale,
  summonMob,
}) {
  const pgx = Math.floor(camera.x);
  const pgz = Math.floor(camera.z);
  const playerOnSolid = solidData[pgz * dungeonWidth + pgx] !== 0;
  const playerCellOccupied = mobs.some((m) => m.x === pgx && m.z === pgz);
  const summonDisabled = playerOnSolid || playerCellOccupied;

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
          goldDrops={goldDrops}
          itemDrops={itemDrops}
          scale={scale}
          className={styles.canvas}
        />
      </div>
      <div className={styles.controls}></div>
      <HandsRow />
      {mobs.length > 0 && (
        <div className={styles.mobRoster}>
          {mobs.map((mob, i) => (
            <MobEntry
              key={i}
              mob={mob}
              onSummon={() => summonMob(i)}
              summonDisabled={summonDisabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
