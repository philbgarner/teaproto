// hooks/useInventory.ts
// React hook for inventory management and UI interactions

import { useState, useCallback } from 'react';
import { ECSManager } from '../ECSManager';
import { InventoryItem, ItemEffect } from '../ComponentRegistry';

export interface InventoryHookReturn {
  inventory: InventoryItem[];
  selectedItem: InventoryItem | null;
  selectItem: (item: InventoryItem | null) => void;
  useItem: (itemId: string) => void;
  dropItem: (itemId: string, quantity?: number) => void;
  transferItem: (itemId: string, targetEntityId: number, quantity?: number) => void;
  isInventoryFull: boolean;
  canUseItem: (item: InventoryItem) => boolean;
}

export function useInventory(
  ecsManager: ECSManager,
  playerId: number,
  inventorySystem?: any // InventorySystem instance
): InventoryHookReturn {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Refresh inventory from ECS
  const refreshInventory = useCallback(() => {
    if (inventorySystem) {
      const items = inventorySystem.getInventoryContents(ecsManager, playerId);
      setInventory(items);
    }
  }, [ecsManager, playerId, inventorySystem]);
  
  // Select item for interaction
  const selectItem = useCallback((item: InventoryItem | null) => {
    setSelectedItem(item);
  }, []);
  
  // Use item (double-click or use button)
  const useItem = useCallback((itemId: string) => {
    if (!inventorySystem) return;
    
    const success = inventorySystem.useItem(ecsManager, playerId, itemId);
    if (success) {
      refreshInventory();
      setSelectedItem(null); // Deselect after use
    }
  }, [ecsManager, playerId, inventorySystem, refreshInventory]);
  
  // Drop item to ground
  const dropItem = useCallback((itemId: string, quantity = 1) => {
    if (!inventorySystem) return;
    
    const droppedEntityId = inventorySystem.dropItem(ecsManager, playerId, itemId, quantity);
    if (droppedEntityId) {
      refreshInventory();
      if (selectedItem?.id === itemId) {
        setSelectedItem(null); // Deselect if dropped item was selected
      }
    }
  }, [ecsManager, playerId, inventorySystem, selectedItem, refreshInventory]);
  
  // Transfer item to another entity (chest, NPC, etc.)
  const transferItem = useCallback((itemId: string, targetEntityId: number, quantity = 1) => {
    if (!inventorySystem) return;
    
    const success = inventorySystem.transferItem(ecsManager, playerId, targetEntityId, itemId, quantity);
    if (success) {
      refreshInventory();
      if (selectedItem?.id === itemId) {
        setSelectedItem(null); // Deselect if transferred item was selected
      }
    }
  }, [ecsManager, playerId, inventorySystem, selectedItem, refreshInventory]);
  
  // Check if inventory is full
  const isInventoryFull = useCallback(() => {
    const playerInventory = ecsManager.getComponent(playerId, 'Inventory');
    return playerInventory ? playerInventory.items.length >= playerInventory.capacity : false;
  }, [ecsManager, playerId]);
  
  // Check if item can be used
  const canUseItem = useCallback((item: InventoryItem) => {
    // Check if item has usable effect
    const usableItems = ['bandage', 'health_potion', 'sword', 'teleport_scroll'];
    return usableItems.includes(item.itemType);
  }, []);
  
  return {
    inventory,
    selectedItem,
    selectItem,
    useItem,
    dropItem,
    transferItem,
    isInventoryFull: isInventoryFull(),
    canUseItem,
  };
}

// Example inventory UI component
export function InventoryUI({ 
  inventoryHook, 
  onItemUse, 
  onItemDrop, 
  onItemTransfer 
}: {
  inventoryHook: InventoryHookReturn;
  onItemUse?: (item: InventoryItem) => void;
  onItemDrop?: (item: InventoryItem) => void;
  onItemTransfer?: (item: InventoryItem) => void;
}) {
  const { 
    inventory, 
    selectedItem, 
    selectItem, 
    useItem, 
    dropItem, 
    canUseItem 
  } = inventoryHook;
  
  const handleDoubleClick = (item: InventoryItem) => {
    if (canUseItem(item)) {
      useItem(item.id);
      onItemUse?.(item);
    }
  };
  
  const handleRightClick = (item: InventoryItem, event: React.MouseEvent) => {
    event.preventDefault(); // Prevent context menu
    selectItem(item);
  };
  
  const handleDrop = () => {
    if (selectedItem) {
      dropItem(selectedItem.id);
      onItemDrop?.(selectedItem);
      selectItem(null);
    }
  };
  
  const handleTransfer = (targetEntityId: number) => {
    if (selectedItem) {
      // This would need a target selection system
      console.log(`Transfer ${selectedItem.itemType} to entity ${targetEntityId}`);
      onItemTransfer?.(selectedItem);
    }
  };
  
  return (
    <div className="inventory-ui">
      <h3>Inventory</h3>
      
      {/* Inventory Grid */}
      <div className="inventory-grid">
        {inventory.map((item, index) => (
          <div
            key={item.id}
            className={`inventory-slot ${selectedItem?.id === item.id ? 'selected' : ''}`}
            onDoubleClick={() => handleDoubleClick(item)}
            onContextMenu={(e) => handleRightClick(item, e)}
            onClick={() => selectItem(item)}
          >
            <div className="item-icon">
              <img src={`/textures/${item.itemType}.png`} alt={item.itemType} />
            </div>
            {item.quantity > 1 && (
              <div className="item-quantity">{item.quantity}</div>
            )}
            <div className="item-name">{item.itemType}</div>
            {canUseItem(item) && (
              <div className="item-usable">Usable</div>
            )}
          </div>
        ))}
        
        {/* Empty slots */}
        {Array.from({ length: 20 - inventory.length }).map((_, index) => (
          <div key={`empty-${index}`} className="inventory-slot empty" />
        ))}
      </div>
      
      {/* Selected Item Actions */}
      {selectedItem && (
        <div className="selected-item-actions">
          <h4>Selected: {selectedItem.itemType}</h4>
          <div className="item-details">
            <p>Quantity: {selectedItem.quantity}</p>
            <p>Stackable: {selectedItem.stackable ? 'Yes' : 'No'}</p>
            {canUseItem(selectedItem) && (
              <p className="usable-hint">Double-click to use</p>
            )}
          </div>
          
          <div className="action-buttons">
            <button onClick={() => useItem(selectedItem.id)} disabled={!canUseItem(selectedItem)}>
              Use Item
            </button>
            <button onClick={handleDrop}>
              Drop Item
            </button>
            <button onClick={() => handleTransfer(0)} disabled={true}>
              Transfer (needs target)
            </button>
          </div>
        </div>
      )}
      
      {/* Inventory Status */}
      <div className="inventory-status">
        <p>Items: {inventory.length}/20</p>
        {inventoryHook.isInventoryFull && (
          <p className="warning">Inventory is full!</p>
        )}
      </div>
    </div>
  );
}

// Context menu for item interactions
export function ItemContextMenu({ 
  item, 
  position, 
  onClose, 
  onUse, 
  onDrop, 
  onTransfer, 
  onExamine 
}: {
  item: InventoryItem;
  position: { x: number; y: number };
  onClose: () => void;
  onUse?: (item: InventoryItem) => void;
  onDrop?: (item: InventoryItem) => void;
  onTransfer?: (item: InventoryItem) => void;
  onExamine?: (item: InventoryItem) => void;
}) {
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };
  
  return (
    <div 
      className="context-menu" 
      style={{ left: position.x, top: position.y }}
    >
      <button onClick={() => handleAction(() => onExamine?.(item))}>
        Examine
      </button>
      {canUseItem(item) && (
        <button onClick={() => handleAction(() => onUse?.(item))}>
          Use
        </button>
      )}
      <button onClick={() => handleAction(() => onDrop?.(item))}>
        Drop
      </button>
      <button onClick={() => handleAction(() => onTransfer?.(item))}>
        Transfer
      </button>
    </div>
  );
}

// Helper function to check if item can be used
function canUseItem(item: InventoryItem): boolean {
  const usableItems = ['bandage', 'health_potion', 'sword', 'teleport_scroll'];
  return usableItems.includes(item.itemType);
}
