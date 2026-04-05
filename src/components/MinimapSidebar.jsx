import { useState } from "react";
import { useSettings } from "../SettingsContext";
import { Minimap } from "./Minimap";
import { ArrowMovement } from "./ArrowMovement";
import styles from "./styles/MinimapSidebar.module.css";
import ghostStyles from "./styles/GhostInventory.module.css";

const RPS_COLORS = {
  poisoned: "#22dd44",
  freezing: "#44aaff",
  bleeding: "#ff3333",
};

const RPS_ICONS = {
  poisoned: "poison_drop_imaya.png",
  freezing: "flake_imaya.png",
  bleeding: "blood_drop_imaya.png",
};

const IMG_MAPPING = {
  "Green Tea": "tea-green.png",
  "Iced Tea": "tea-iced.png",
  "Spicy Tea": "tea-spicy.png",
};

const ING_MAPPING = {
  "Frost Leaf": "frost_leaf.png",
  "Hot Pepper": "hot_pepper.png",
  "Wild Herb": "wild_herb.png",
};

function HandSlot({ items, registry, side, handleTeaInteraction }) {
  const item = items[0];
  const name = item ? registry.getSlotObjectName(item) : null;
  const isEmpty = !name;

  const handleClick = () => {
    if (!isEmpty && handleTeaInteraction) {
      handleTeaInteraction(side);
    }
  };

  return (
    <button
      className={`${ghostStyles.inventorySlot} ${isEmpty ? ghostStyles.emptySlot : ""} ${ghostStyles.handSlot}`}
      onClick={handleClick}
      disabled={isEmpty}
    >
      <div className={ghostStyles.itemImage}>
        {!isEmpty ? (
          <img src={`textures/${IMG_MAPPING[name]}`} />
        ) : (
          <img src={`textures/hand_${side}.png`} />
        )}
      </div>
      {!isEmpty && <div className={ghostStyles.itemText}>{name}</div>}
    </button>
  );
}

function HandsRow({ handleTeaInteraction }) {
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
    <div className={ghostStyles.handsRow}>
      <HandSlot items={leftHandItems} registry={registry} side="left" handleTeaInteraction={handleTeaInteraction} />
      <HandSlot items={rightHandItems} registry={registry} side="right" handleTeaInteraction={handleTeaInteraction} />
    </div>
  );
}

function IngredientSlot({ slot, registry }) {
  const name = registry.getSlotObjectName(slot) ?? null;
  const isEmpty = !name;
  const quantity = registry.getSlotQuantity(slot);

  return (
    <div
      className={`${ghostStyles.inventorySlot} ${isEmpty ? ghostStyles.emptySlot : ""} ${ghostStyles.ingredientSlot}`}
    >
      {!isEmpty ? (
        <>
          <div className={ghostStyles.ingredientImage}>
            <img src={`textures/${ING_MAPPING[name]}`} />
          </div>
          <div className={ghostStyles.ingredientName}>{name}</div>
          <div className={ghostStyles.ingredientQuantity}>x{quantity}</div>
        </>
      ) : (
        <div className={ghostStyles.emptyIngredient}>empty</div>
      )}
    </div>
  );
}

function IngredientRow() {
  const { playerData } = useSettings();
  const { registry, playerInventory } = playerData.ecsData;

  const inventory = registry.components.inventory.get(playerInventory);

  return (
    <div className={ghostStyles.ingredientRow}>
      <IngredientSlot slot={inventory.slots[0]} registry={registry} />
      <IngredientSlot slot={inventory.slots[1]} registry={registry} />
      <IngredientSlot slot={inventory.slots[2]} registry={registry} />
    </div>
  );
}

function MobEntry({ mob, onSummon, summonDisabled }) {
  const effectColor = mob.rpsEffect ? RPS_COLORS[mob.rpsEffect] : undefined;
  const effectIcon =
    mob.rpsEffect && mob.rpsEffect !== "none" ? RPS_ICONS[mob.rpsEffect] : null;

  const hpFrac = mob.hp !== undefined && mob.maxHp ? mob.hp / mob.maxHp : null;
  const armorFrac =
    mob.satiation !== undefined && mob.maxSatiation
      ? Math.min(1, mob.satiation / mob.maxSatiation)
      : null;

  return (
    <div className={styles.mobEntry}>
      <div className={styles.mobNameRow}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            flex: 1,
            gap: "0.25rem",
            minWidth: 0,
          }}
        >
          {effectIcon && (
            <img
              src={`textures/${effectIcon}`}
              style={{
                width: "24px",
                height: "24px",
                imageRendering: "pixelated",
                flexShrink: 0,
              }}
            />
          )}
          <span
            className={styles.mobName}
            style={{
              color: effectColor || "inherit",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {mob.name ?? "Monster"}
          </span>
        </div>
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
        <div className={`${styles.mobRow} ${styles.hpRow}`}>
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
  handleTeaInteraction,
  moveActions,
  onInteract,
}) {
  const [activeTab, setActiveTab] = useState("move");

  const pgx = Math.floor(camera.x);
  const pgz = Math.floor(camera.z);
  const playerOnSolid = solidData[pgz * dungeonWidth + pgx] !== 0;
  const playerCellOccupied = mobs.some((m) => m.x === pgx && m.z === pgz);
  const summonDisabled = playerOnSolid || playerCellOccupied;

  const metMobs = mobs.filter((f) => f.hasMet);

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
      <HandsRow handleTeaInteraction={handleTeaInteraction} />
      <IngredientRow />
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === "move" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("move")}
        >
          move
        </button>
        <button
          className={`${styles.tab} ${activeTab === "summon" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("summon")}
        >
          summon
        </button>
      </div>
      <div className={styles.tabContent}>
        {activeTab === "move" && moveActions && (
          <ArrowMovement moveActions={moveActions} onInteract={onInteract} />
        )}
        {activeTab === "summon" && metMobs.length > 0 && (
          <div className={styles.mobRoster}>
            {metMobs.map((mob, i) => (
              <MobEntry
                key={i}
                mob={mob}
                onSummon={() => summonMob(mobs.indexOf(mob), pgx, pgz)}
                summonDisabled={summonDisabled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
