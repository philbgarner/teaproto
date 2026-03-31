// Systems/SaveSystem.ts
// Handles game state serialization and save/load functionality

import { ECSManager } from '../ECSManager';
import { ComponentType } from '../ComponentRegistry';

export interface GameState {
  version: string;
  timestamp: number;
  playerEntityId: number;
  entities: SerializedEntity[];
  globalState: GlobalGameState;
}

export interface SerializedEntity {
  id: number;
  components: Record<string, any>;
}

export interface GlobalGameState {
  turnCount: number;
  isPlayerTurn: boolean;
  gameState: 'playing' | 'victory' | 'defeat';
  turnDelay: number;
  timestamp?: number; // Optional timestamp for save metadata
  // Add any other global game state
}

export class SaveSystem {
  private static readonly SAVE_VERSION = '1.0.0';
  private static readonly SAVE_KEY_PREFIX = 'teaproto_save_';
  
  // Serialize entire game state
  static serializeGame(
    ecsManager: ECSManager,
    playerEntityId: number,
    globalState: GlobalGameState
  ): GameState {
    const entities: SerializedEntity[] = [];
    
    // Get all entities
    const allEntityIds = ecsManager.getActiveEntities();
    
    // Serialize each entity
    allEntityIds.forEach((entityId: number) => {
      const serializedEntity = this.serializeEntity(ecsManager, entityId);
      if (serializedEntity) {
        entities.push(serializedEntity);
      }
    });
    
    return {
      version: this.SAVE_VERSION,
      timestamp: Date.now(),
      playerEntityId,
      entities,
      globalState: {
        ...globalState,
        timestamp: Date.now()
      }
    };
  }
  
  // Deserialize and restore game state
  static deserializeGame(
    ecsManager: ECSManager,
    gameState: GameState
  ): { playerEntityId: number; globalState: GlobalGameState } {
    // Clear existing entities (except keep system entities if needed)
    const existingEntities = ecsManager.getActiveEntities();
    existingEntities.forEach((id: number) => {
      ecsManager.removeEntity(id);
    });
    
    // Restore entities
    const entityMap = new Map<number, number>(); // oldId -> newId mapping
    
    gameState.entities.forEach(serializedEntity => {
      const newEntityId = this.deserializeEntity(ecsManager, serializedEntity);
      entityMap.set(serializedEntity.id, newEntityId);
    });
    
    // Update player entity ID
    const newPlayerEntityId = entityMap.get(gameState.playerEntityId) || -1;
    
    return {
      playerEntityId: newPlayerEntityId,
      globalState: gameState.globalState
    };
  }
  
  // Serialize single entity
  static serializeEntity(ecsManager: ECSManager, entityId: number): SerializedEntity | null {
    const components: Record<string, any> = {};
    
    // Get all component types for this entity
    const componentTypes: ComponentType[] = [
      'Position', 'Health', 'Inventory', 'Renderable', 'Tag', 
      'Mob', 'Item', 'Collision', 'Door'
    ];
    
    // Serialize each component
    componentTypes.forEach((componentType: ComponentType) => {
      const component = ecsManager.getComponent(entityId, componentType);
      if (component) {
        // Deep clone component data
        components[componentType] = JSON.parse(JSON.stringify(component));
      }
    });
    
    // Skip entities with no components
    if (Object.keys(components).length === 0) {
      return null;
    }
    
    return {
      id: entityId,
      components
    };
  }
  
  // Deserialize single entity
  static deserializeEntity(
    ecsManager: ECSManager, 
    serializedEntity: SerializedEntity
  ): number {
    const entityId = ecsManager.createEntity();
    
    // Restore all components
    Object.entries(serializedEntity.components).forEach(([componentType, componentData]) => {
      try {
        // Validate component data before adding
        if (this.validateComponentData(componentType as ComponentType, componentData)) {
          ecsManager.addComponent(entityId, componentType as ComponentType, componentData);
        }
      } catch (error) {
        console.warn(`Failed to deserialize component ${componentType} for entity ${entityId}:`, error);
      }
    });
    
    return entityId;
  }
  
  // Validate component data before deserialization
  // ⚠️ IMPORTANT: When adding new component types, update this switch statement
  // See ComponentType definition for reminder comment
  private static validateComponentData(
    componentType: ComponentType, 
    data: any
  ): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Basic validation for each component type
    switch (componentType) {
      case 'Position':
        return typeof data.x === 'number' && typeof data.y === 'number';
      case 'Health':
        return typeof data.max === 'number' && typeof data.current === 'number';
      case 'Inventory':
        return Array.isArray(data.items) && typeof data.capacity === 'number';
      case 'Renderable':
        return typeof data.texture === 'string' && typeof data.layer === 'number';
      case 'Tag':
        return typeof data.name === 'string';
      case 'Mob':
        return typeof data.type === 'string' && typeof data.moveCooldown === 'number';
      case 'Item':
        return typeof data.itemType === 'string' && typeof data.quantity === 'number';
      case 'Collision':
        return typeof data.solid === 'boolean' && typeof data.width === 'number';
      default:
        return true; // Allow unknown components for forward compatibility
    }
  }
  
  // Save game to localStorage
  static saveToLocalStorage(
    ecsManager: ECSManager,
    playerEntityId: number,
    globalState: GlobalGameState,
    saveSlot: number = 1
  ): boolean {
    try {
      const gameState = this.serializeGame(ecsManager, playerEntityId, globalState);
      const saveKey = `${this.SAVE_KEY_PREFIX}${saveSlot}`;
      
      localStorage.setItem(saveKey, JSON.stringify(gameState));
      
      // Also save metadata for save slots
      this.updateSaveSlotMetadata(saveSlot, gameState);
      
      console.log(`Game saved to slot ${saveSlot}`);
      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }
  
  // Load game from localStorage
  static loadFromLocalStorage(
    ecsManager: ECSManager,
    saveSlot: number = 1
  ): { playerEntityId: number; globalState: GlobalGameState } | null {
    try {
      const saveKey = `${this.SAVE_KEY_PREFIX}${saveSlot}`;
      const saveData = localStorage.getItem(saveKey);
      
      if (!saveData) {
        console.log(`No save found in slot ${saveSlot}`);
        return null;
      }
      
      const gameState: GameState = JSON.parse(saveData);
      
      // Validate save version
      if (gameState.version !== this.SAVE_VERSION) {
        console.warn(`Save version mismatch. Expected ${this.SAVE_VERSION}, got ${gameState.version}`);
        // Could implement migration logic here
      }
      
      console.log(`Loading game from slot ${saveSlot}`);
      return this.deserializeGame(ecsManager, gameState);
    } catch (error) {
      console.error('Failed to load game:', error);
      return null;
    }
  }
  
  // Get save slot metadata
  static getSaveSlotMetadata(saveSlot: number): SaveSlotMetadata | null {
    try {
      const metadataKey = `${this.SAVE_KEY_PREFIX}${saveSlot}_meta`;
      const metadata = localStorage.getItem(metadataKey);
      return metadata ? JSON.parse(metadata) : null;
    } catch {
      return null;
    }
  }
  
  // Update save slot metadata
  private static updateSaveSlotMetadata(saveSlot: number, gameState: GameState): void {
    const metadata: SaveSlotMetadata = {
      slot: saveSlot,
      timestamp: gameState.timestamp,
      playerEntityId: gameState.playerEntityId,
      entityCount: gameState.entities.length,
      turnCount: gameState.globalState.turnCount,
      gameState: gameState.globalState.gameState
    };
    
    const metadataKey = `${this.SAVE_KEY_PREFIX}${saveSlot}_meta`;
    localStorage.setItem(metadataKey, JSON.stringify(metadata));
  }
  
  // Delete save slot
  static deleteSaveSlot(saveSlot: number): boolean {
    try {
      const saveKey = `${this.SAVE_KEY_PREFIX}${saveSlot}`;
      const metadataKey = `${this.SAVE_KEY_PREFIX}${saveSlot}_meta`;
      
      localStorage.removeItem(saveKey);
      localStorage.removeItem(metadataKey);
      
      console.log(`Deleted save slot ${saveSlot}`);
      return true;
    } catch (error) {
      console.error('Failed to delete save slot:', error);
      return false;
    }
  }
  
  // Check if save slot exists
  static hasSaveSlot(saveSlot: number): boolean {
    const saveKey = `${this.SAVE_KEY_PREFIX}${saveSlot}`;
    return localStorage.getItem(saveKey) !== null;
  }
  
  // Get all save slots metadata
  static getAllSaveSlots(): SaveSlotMetadata[] {
    const slots: SaveSlotMetadata[] = [];
    
    for (let i = 1; i <= 10; i++) { // Support 10 save slots
      const metadata = this.getSaveSlotMetadata(i);
      if (metadata) {
        slots.push(metadata);
      }
    }
    
    return slots.sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  }
  
  // Export save to file
  static exportToFile(
    ecsManager: ECSManager,
    playerEntityId: number,
    globalState: GlobalGameState,
    filename?: string
  ): boolean {
    try {
      const gameState = this.serializeGame(ecsManager, playerEntityId, globalState);
      const saveData = JSON.stringify(gameState, null, 2);
      
      const blob = new Blob([saveData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `teaproto_save_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Game exported to file');
      return true;
    } catch (error) {
      console.error('Failed to export save:', error);
      return false;
    }
  }
  
  // Import save from file
  static importFromFile(
    ecsManager: ECSManager,
    file: File
  ): Promise<{ playerEntityId: number; globalState: GlobalGameState } | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const gameState: GameState = JSON.parse(content);
          
          const result = this.deserializeGame(ecsManager, gameState);
          resolve(result);
        } catch (error) {
          console.error('Failed to import save:', error);
          resolve(null);
        }
      };
      
      reader.onerror = () => {
        console.error('Failed to read save file');
        resolve(null);
      };
      
      reader.readAsText(file);
    });
  }
}

export interface SaveSlotMetadata {
  slot: number;
  timestamp: number;
  playerEntityId: number;
  entityCount: number;
  turnCount: number;
  gameState: 'playing' | 'victory' | 'defeat';
}
