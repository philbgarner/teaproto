import { useSettings } from "../SettingsContext";
import styles from "./styles/GhostInventory.module.css";

interface GhostInventoryProps {
  columnsPerRow?: number;
}

function LeftHandEmpty() {
  return (
    <div
      style={{
        backgroundImage: `${import.meta.env.BASE_URL}textures/icons.png`,
      }}
    ></div>
  );
}

export default function GhostInventory({
  columnsPerRow = 3,
}: GhostInventoryProps) {
  const { playerData } = useSettings();
  const { registry, playerEntity, playerInventory, leftHand, rightHand } =
    playerData.ecsData;

  const slots =
    playerInventory != null
      ? (registry.components.inventory.get(playerInventory)?.slots ?? [])
      : registry.getFirstInventorySlots(playerEntity);

  const leftHandItem =
    leftHand != null
      ? (registry.components.inventory.get(leftHand)?.slots ?? [])
      : [];

  const rightHandItem =
    rightHand != null
      ? (registry.components.inventory.get(rightHand)?.slots ?? [])
      : [];

  return (
    <div
      className={styles.inventoryContainer}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", flexDirection: "row" }}>
        <button
          key={"lefthand"}
          className={`${styles.inventorySlot} ${!leftHandItem[0] || !registry.getSlotObjectName(leftHandItem[0]) ? styles.emptySlot : ""}`}
          style={{ maxWidth: "50%" }}
          disabled={
            !leftHandItem[0] || !registry.getSlotObjectName(leftHandItem[0])
          }
        >
          {leftHandItem[0] && registry.getSlotObjectName(leftHandItem[0]) ? (
            <>
              <span className={styles.itemName}>
                {registry.getSlotObjectName(leftHandItem[0])}
              </span>
              {registry.getSlotQuantity(leftHandItem[0]) > 1 && (
                <span className={styles.itemCount}>
                  ×{registry.getSlotQuantity(leftHandItem[0])}
                </span>
              )}
            </>
          ) : (
            "(left)"
          )}
        </button>
        <button
          key={"righthand"}
          className={`${styles.inventorySlot} ${!rightHandItem[0] || !registry.getSlotObjectName(rightHandItem[0]) ? styles.emptySlot : ""}`}
          style={{ maxWidth: "50%" }}
          disabled={
            !rightHandItem[0] || !registry.getSlotObjectName(rightHandItem[0])
          }
        >
          {rightHandItem[0] && registry.getSlotObjectName(rightHandItem[0]) ? (
            <>
              <span className={styles.itemName}>
                {registry.getSlotObjectName(rightHandItem[0])}
              </span>
              {registry.getSlotQuantity(rightHandItem[0]) > 1 && (
                <span className={styles.itemCount}>
                  ×{registry.getSlotQuantity(rightHandItem[0])}
                </span>
              )}
            </>
          ) : (
            "(right)"
          )}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {slots.map((slotEntity) => {
          const name = registry.getSlotObjectName(slotEntity);
          const count = registry.getSlotQuantity(slotEntity);
          const isEmpty = !name;

          return (
            <button
              key={slotEntity}
              className={`${styles.inventorySlot} ${isEmpty ? styles.emptySlot : ""}`}
              disabled={isEmpty}
            >
              {!isEmpty && (
                <>
                  <span className={styles.itemName}>{name}</span>
                  {count > 1 && (
                    <span className={styles.itemCount}>×{count}</span>
                  )}
                </>
              )}
              {isEmpty && `(empty)`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
