import { useSettings } from "../SettingsContext";
import styles from "./styles/GhostInventory.module.css";

interface GhostInventoryProps {
  columnsPerRow?: number;
}

export default function GhostInventory({
  columnsPerRow = 3,
}: GhostInventoryProps) {
  const { playerData } = useSettings();
  const { registry, playerEntity, playerInventory } = playerData.ecsData;

  const slots =
    playerInventory != null
      ? (registry.components.inventory.get(playerInventory)?.slots ?? [])
      : registry.getFirstInventorySlots(playerEntity);

  return (
    <div
      className={styles.inventoryContainer}
      style={{ gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)` }}
    >
      <div style={{ display: "flex", flexDirection: "row" }}>
        <button key={"lefthand"}>left hand</button>
        <button key={"righthand"}>left hand</button>
      </div>

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
  );
}
