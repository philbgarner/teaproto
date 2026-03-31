// Systems/InventorySystem.ts
// Handles inventory operations and item interactions

import { System } from '../System';
import { ECSManager } from '../ECSManager';
import { Inventory, InventoryItem, Item, ItemEffect } from '../ComponentRegistry';

export class InventorySystem extends System {
  constructor() {
    super(['Inventory']);
  }
  
  update(ecsManager: ECSManager, deltaTime: number): void {
    // Inventory system doesn't need per-frame updates
    // All operations are event-driven
  }
  
  // Add item to inventory
  addItem(ecsManager: ECSManager, entityId: number, itemData: Item): boolean {
    const inventory = ecsManager.getComponent(entityId, 'Inventory');
    
    if (!inventory) {
      console.error('Entity has no inventory component');
      return false;
    }
    
    // Check capacity
    if (inventory.items.length >= inventory.capacity) {
      console.log('Inventory is full');
      return false;
    }
    
    // Check if item already exists (for stacking)
    const existingItem = inventory.items.find(item => 
      item.itemType === itemData.itemType && item.stackable
    );
    
    if (existingItem && itemData.stackable) {
      // Stack with existing item
      existingItem.quantity += itemData.quantity;
      console.log(`Added ${itemData.quantity} ${itemData.itemType} to stack (now ${existingItem.quantity})`);
    } else {
      // Add new item
      const inventoryItem: InventoryItem = {
        id: this.generateItemId(),
        itemType: itemData.itemType,
        quantity: itemData.quantity,
        stackable: itemData.stackable,
        durability: itemData.properties?.durability,
        properties: itemData.properties
      };
      
      inventory.items.push(inventoryItem);
      console.log(`Added ${itemData.quantity} ${itemData.itemType} to inventory`);
    }
    
    return true;
  }
  
  // Remove item from inventory
  removeItem(ecsManager: ECSManager, entityId: number, itemId: string, quantity = 1): boolean {
    const inventory = ecsManager.getComponent(entityId, 'Inventory');
    
    if (!inventory) return false;
    
    const itemIndex = inventory.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;
    
    const item = inventory.items[itemIndex];
    
    if (item.quantity > quantity) {
      // Remove partial quantity
      item.quantity -= quantity;
      console.log(`Removed ${quantity} ${item.itemType} from inventory (${item.quantity} remaining)`);
    } else {
      // Remove entire item
      inventory.items.splice(itemIndex, 1);
      console.log(`Removed ${item.itemType} from inventory`);
    }
    
    return true;
  }
  
  // Use item from inventory
  useItem(ecsManager: ECSManager, entityId: number, itemId: string): boolean {
    const inventory = ecsManager.getComponent(entityId, 'Inventory');
    const health = ecsManager.getComponent(entityId, 'Health');
    
    if (!inventory || !health) return false;
    
    const item = inventory.items.find(item => item.id === itemId);
    if (!item) return false;
    
    // Get item effect from world entities or use default effects
    const itemEffect = this.getItemEffect(item.itemType);
    
    if (!itemEffect) {
      console.log(`${item.itemType} has no usable effect`);
      return false;
    }
    
    // Apply effect based on type
    switch (itemEffect.type) {
      case 'heal':
        if (itemEffect.value) {
          health.current = Math.min(health.current + itemEffect.value, health.max);
          console.log(`Used ${item.itemType}: healed ${itemEffect.value} HP (now ${health.current}/${health.max})`);
        }
        break;
        
      case 'damage':
        // Would need to find nearby enemies to damage
        console.log(`${item.itemType} would damage enemies (not implemented)`);
        break;
        
      case 'buff':
        // Would need to implement buff system
        console.log(`${item.itemType} would apply buff (not implemented)`);
        break;
        
      case 'teleport':
        // Would need to implement teleportation
        console.log(`${item.itemType} would teleport (not implemented)`);
        break;
        
      case 'key':
        console.log(`${item.itemType} is a key item`);
        return true; // Don't consume key items unless specified
        
      case 'custom':
        if (itemEffect.customEffect) {
          itemEffect.customEffect(ecsManager, entityId);
        }
        break;
    }
    
    // Remove item after use (unless it's a key or reusable)
    if (itemEffect.type !== 'key' && itemEffect.type !== 'buff' && itemEffect.type !== 'custom' && itemEffect.type !== 'teleport') {
      this.removeItem(ecsManager, entityId, itemId, 1);
    }
    
    return true;
  }
  
  // Transfer item between inventories
  transferItem(
    ecsManager: ECSManager, 
    fromEntityId: number, 
    toEntityId: number, 
    itemId: string, 
    quantity = 1
  ): boolean {
    const fromInventory = ecsManager.getComponent(fromEntityId, 'Inventory');
    const toInventory = ecsManager.getComponent(toEntityId, 'Inventory');
    
    if (!fromInventory || !toInventory) return false;
    
    const item = fromInventory.items.find(item => item.id === itemId);
    if (!item) return false;
    
    // Check if target inventory has space
    if (toInventory.items.length >= toInventory.capacity) {
      console.log('Target inventory is full');
      return false;
    }
    
    // Remove from source
    if (!this.removeItem(ecsManager, fromEntityId, itemId, quantity)) {
      return false;
    }
    
    // Add to target
    const transferItem: InventoryItem = {
      ...item,
      quantity: Math.min(quantity, item.quantity)
    };
    
    toInventory.items.push(transferItem);
    console.log(`Transferred ${transferItem.quantity} ${transferItem.itemType} from entity ${fromEntityId} to ${toEntityId}`);
    
    return true;
  }
  
  // Drop item from inventory to ground
  dropItem(ecsManager: ECSManager, entityId: number, itemId: string, quantity = 1): number | null {
    const inventory = ecsManager.getComponent(entityId, 'Inventory');
    const position = ecsManager.getComponent(entityId, 'Position');
    
    if (!inventory || !position) return null;
    
    const item = inventory.items.find(item => item.id === itemId);
    if (!item) return null;
    
    // Create new entity for dropped item
    const droppedItemId = ecsManager.createEntity();
    ecsManager.addComponent(droppedItemId, 'Position', { x: position.x, y: position.y });
    ecsManager.addComponent(droppedItemId, 'Renderable', { 
      texture: `${item.itemType}_texture`, 
      layer: 2, 
      visible: true 
    });
    ecsManager.addComponent(droppedItemId, 'Tag', { name: 'item' });
    ecsManager.addComponent(droppedItemId, 'Item', {
      itemType: item.itemType,
      stackable: item.stackable,
      quantity: Math.min(quantity, item.quantity),
      usable: true,
      autoPickup: false
    });
    ecsManager.addComponent(droppedItemId, 'Collision', { solid: false, width: 0.5, height: 0.5 });
    
    // Remove from inventory
    this.removeItem(ecsManager, entityId, itemId, quantity);
    
    console.log(`Dropped ${item.itemType} at (${position.x}, ${position.y})`);
    return droppedItemId;
  }
  
  // Get inventory contents for UI
  getInventoryContents(ecsManager: ECSManager, entityId: number): InventoryItem[] {
    const inventory = ecsManager.getComponent(entityId, 'Inventory');
    return inventory ? [...inventory.items] : [];
  }
  
  // Check if inventory has specific item
  hasItem(ecsManager: ECSManager, entityId: number, itemType: string): boolean {
    const inventory = ecsManager.getComponent(entityId, 'Inventory');
    if (!inventory) return false;
    
    return inventory.items.some(item => item.itemType === itemType);
  }
  
  // Get item count
  getItemCount(ecsManager: ECSManager, entityId: number, itemType: string): number {
    const inventory = ecsManager.getComponent(entityId, 'Inventory');
    if (!inventory) return 0;
    
    const item = inventory.items.find(item => item.itemType === itemType);
    return item ? item.quantity : 0;
  }
  
  // Generate unique item ID
  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Get predefined item effects
  private getItemEffect(itemType: string): ItemEffect | null {
    const effects: Record<string, ItemEffect> = {
      'bandage': {
        type: 'heal',
        value: 20,
        target: 'self'
      },
      'health_potion': {
        type: 'heal',
        value: 50,
        target: 'self'
      },
      'sword': {
        type: 'damage',
        value: 15,
        target: 'enemy'
      },
      'key': {
        type: 'key' as const,
        target: 'self'
      },
      'teleport_scroll': {
        type: 'teleport',
        target: 'self'
      }
    };
    
    return effects[itemType] || null;
  }
}
