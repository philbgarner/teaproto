// ComponentRegistry.ts
// Central registry for all component types and their data interfaces

export interface Position {
  x: number;
  y: number;
}

export interface Health {
  max: number;
  current: number;
}

export interface Inventory {
  items: InventoryItem[]; // Enhanced item storage
  capacity: number;
}

export interface InventoryItem {
  id: string;
  itemType: string;
  quantity: number;
  stackable: boolean;
  durability?: number;
  properties?: Record<string, any>; // Custom properties for different item types
}

export interface Renderable {
  texture: string;
  layer: number;
  visible: boolean;
}

export interface Door {
  open: boolean;
  locked: boolean;
  keyId?: string;
}

export interface Tag {
  name: string;
}

export interface Mob {
  type: string;
  aiState: 'idle' | 'patrol' | 'chase' | 'attack';
  lastPlayerX?: number;
  lastPlayerY?: number;
  moveCooldown: number; // Turns until next move
}

export interface Item {
  itemType: string;
  stackable: boolean;
  quantity: number;
  usable: boolean; // Can item be used?
  effect?: ItemEffect; // What happens when used
  autoPickup?: boolean; // Auto-collect when stepped on
  properties?: Record<string, any>; // Custom properties
}

export interface ItemEffect {
  type: 'heal' | 'damage' | 'buff' | 'teleport' | 'key' | 'custom';
  value?: number;
  duration?: number;
  target?: 'self' | 'enemy' | 'area';
  customEffect?: (ecsManager: any, userEntityId: number) => void;
}

export interface Collision {
  solid: boolean;
  width: number;
  height: number;
}

// Component type mapping for type safety
export interface ComponentMap {
  Position: Position;
  Health: Health;
  Inventory: Inventory;
  Renderable: Renderable;
  Door: Door;
  Tag: Tag;
  Mob: Mob;
  Item: Item;
  Collision: Collision;
}

export type ComponentType = keyof ComponentMap;
// ⚠️ IMPORTANT: When adding new component types, also update:
// - SaveSystem.serializeEntity() componentTypes array
// - SaveSystem.validateComponentData() switch statement
export type ComponentData<T extends ComponentType> = ComponentMap[T];

// Factory functions for component creation
export const componentFactories = {
  Position: (x = 0, y = 0): Position => ({ x, y }),
  Health: (max: number, current?: number): Health => ({ max, current: current ?? max }),
  Inventory: (capacity = 10): Inventory => ({ items: [], capacity }),
  Renderable: (texture: string, layer = 0, visible = true): Renderable => ({ texture, layer, visible }),
  Door: (open = false, locked = false, keyId?: string): Door => ({ open, locked, keyId }),
  Tag: (name: string): Tag => ({ name }),
  Mob: (type: string): Mob => ({ type, aiState: 'idle', moveCooldown: 0 }),
  Item: (itemType: string, stackable = false, quantity = 1, usable = true): Item => ({ 
    itemType, 
    stackable, 
    quantity, 
    usable,
    autoPickup: false 
  }),
  Collision: (solid = true, width = 1, height = 1): Collision => ({ solid, width, height }),
} as const;

// Predefined tag constants for type safety
export const TAGS = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  DOOR: 'door',
  ITEM: 'item',
  WALL: 'wall',
  PROJECTILE: 'projectile',
} as const;

export type TagType = typeof TAGS[keyof typeof TAGS];
