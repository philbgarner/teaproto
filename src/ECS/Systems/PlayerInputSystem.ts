// Systems/PlayerInputSystem.ts
// Handles player input for turn-based movement with buffering

import { System } from '../System';
import { ECSManager } from '../ECSManager';
import { Inventory, InventoryItem, Item } from '../ComponentRegistry';

export interface PlayerInput {
  direction: 'up' | 'down' | 'left' | 'right' | null;
  action: 'move' | 'interact' | 'attack' | null;
}

export interface BufferedInput extends PlayerInput {
  timestamp: number;
  id: number;
}

export class PlayerInputSystem extends System {
  private currentInput: PlayerInput = { direction: null, action: null };
  private playerEntityId: number | null = null;
  private onPlayerMove?: (newPosition: { x: number; y: number }) => void;
  private inputBuffer: BufferedInput[] = [];
  private nextInputId = 0;
  private bufferMaxSize = 5; // Maximum actions to buffer
  private bufferMaxAge = 2000; // Maximum age in milliseconds (2 seconds)
  private isProcessing = false;
  private nextItemId = 0;
  
  constructor(onPlayerMove?: (newPosition: { x: number; y: number }) => void) {
    super(['Position', 'Tag']);
    this.onPlayerMove = onPlayerMove;
  }
  
  // Set player entity (should be called once after player creation)
  setPlayerEntity(entityId: number): void {
    this.playerEntityId = entityId;
  }
  
  // Handle keyboard input
  handleInput(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    
    // Reset current input
    this.currentInput = { direction: null, action: null };
    
    // Movement keys
    switch (key) {
      case 'w':
      case 'arrowup':
        this.currentInput.direction = 'up';
        this.currentInput.action = 'move';
        break;
      case 's':
      case 'arrowdown':
        this.currentInput.direction = 'down';
        this.currentInput.action = 'move';
        break;
      case 'a':
      case 'arrowleft':
        this.currentInput.direction = 'left';
        this.currentInput.action = 'move';
        break;
      case 'd':
      case 'arrowright':
        this.currentInput.direction = 'right';
        this.currentInput.action = 'move';
        break;
      case 'e':
      case ' ':
        this.currentInput.action = 'interact';
        break;
      case 'f':
        this.currentInput.action = 'attack';
        break;
      default:
        return; // No valid input
    }
    
    // Add to buffer if we have a valid action
    if (this.currentInput.action) {
      this.addToBuffer(this.currentInput);
    }
  }
  
  // Add input to buffer with timestamp and ID
  private addToBuffer(input: PlayerInput): void {
    // Remove old inputs (older than bufferMaxAge)
    this.cleanupBuffer();
    
    // Add new input
    const bufferedInput: BufferedInput = {
      ...input,
      timestamp: Date.now(),
      id: this.nextInputId++
    };
    
    this.inputBuffer.push(bufferedInput);
    
    // Limit buffer size
    if (this.inputBuffer.length > this.bufferMaxSize) {
      this.inputBuffer.shift(); // Remove oldest
    }
    
    console.log(`Input buffered: ${input.action} ${input.direction || ''} (Buffer size: ${this.inputBuffer.length})`);
  }
  
  // Remove old inputs from buffer
  private cleanupBuffer(): void {
    const now = Date.now();
    this.inputBuffer = this.inputBuffer.filter(input => 
      now - input.timestamp < this.bufferMaxAge
    );
  }
  
  // Get next input from buffer
  private getNextInput(): BufferedInput | null {
    this.cleanupBuffer();
    
    if (this.inputBuffer.length > 0) {
      const nextInput = this.inputBuffer.shift()!;
      console.log(`Processing buffered input: ${nextInput.action} ${nextInput.direction || ''}`);
      return nextInput;
    }
    
    return null;
  }
  
  // Check if there are buffered inputs
  hasBufferedInputs(): boolean {
    this.cleanupBuffer();
    return this.inputBuffer.length > 0;
  }
  
  // Get buffer status for UI
  getBufferStatus(): { count: number; inputs: BufferedInput[] } {
    this.cleanupBuffer();
    return {
      count: this.inputBuffer.length,
      inputs: [...this.inputBuffer]
    };
  }
  
  // Clear all buffered inputs
  clearBuffer(): void {
    this.inputBuffer = [];
    console.log('Input buffer cleared');
  }
  
  // Process input and move player (buffered version)
  processTurn(ecsManager: ECSManager): void {
    if (!this.playerEntityId) return;
    
    // Prevent multiple simultaneous processing
    if (this.isProcessing) {
      console.log('Already processing input, skipping...');
      return;
    }
    
    // Get next input from buffer, or use current input if buffer is empty
    const bufferedInput = this.getNextInput();
    const inputToProcess = bufferedInput || this.currentInput;
    
    if (!inputToProcess.action) {
      console.log('No input to process');
      return;
    }
    
    this.isProcessing = true;
    
    const position = ecsManager.getComponent(this.playerEntityId, 'Position');
    
    if (!position) {
      this.isProcessing = false;
      return;
    }
    
    let newX = position.x;
    let newY = position.y;
    let actionExecuted = false;
    
    if (inputToProcess.action === 'move' && inputToProcess.direction) {
      // Calculate new position based on direction
      switch (inputToProcess.direction) {
        case 'up':
          newY -= 1;
          break;
        case 'down':
          newY += 1;
          break;
        case 'left':
          newX -= 1;
          break;
        case 'right':
          newX += 1;
          break;
      }
      
      // Check if move is valid (collision detection)
      if (this.canMoveTo(ecsManager, newX, newY)) {
        position.x = newX;
        position.y = newY;
        actionExecuted = true;
        
        // Notify callback about player movement
        if (this.onPlayerMove) {
          this.onPlayerMove({ x: newX, y: newY });
        }
        
        console.log(`Player moved to (${newX}, ${newY})`);
      } else {
        console.log(`Cannot move to (${newX}, ${newY}) - collision detected`);
      }
    } else if (inputToProcess.action === 'interact') {
      this.handleInteraction(ecsManager, position);
      actionExecuted = true;
    } else if (inputToProcess.action === 'attack') {
      this.handleAttack(ecsManager, position);
      actionExecuted = true;
    }
    
    // Clear current input if it was processed
    if (actionExecuted && !bufferedInput) {
      this.currentInput = { direction: null, action: null };
    }
    
    this.isProcessing = false;
    
    // Auto-process next buffered input if available and this was a successful move
    if (actionExecuted && this.hasBufferedInputs()) {
      console.log('Auto-processing next buffered input...');
      setTimeout(() => this.processTurn(ecsManager), 100); // Small delay for visual feedback
    }
  }
  
  private canMoveTo(ecsManager: ECSManager, x: number, y: number): boolean {
    // Get all entities with collision at target position
    const collisionEntities = ecsManager.queryEntities('Collision', 'Position');
    
    for (const entityId of collisionEntities) {
      if (entityId === this.playerEntityId) continue; // Skip self
      
      const collision = ecsManager.getComponent(entityId, 'Collision');
      const entityPos = ecsManager.getComponent(entityId, 'Position');
      
      if (collision?.solid && entityPos) {
        // Simple AABB collision check
        if (Math.abs(entityPos.x - x) < 0.5 && Math.abs(entityPos.y - y) < 0.5) {
          return false; // Collision detected
        }
      }
    }
    
    return true; // No collision
  }
  
  private handleInteraction(ecsManager: ECSManager, playerPos: { x: number; y: number }): void {
    // Find interactable entities nearby (doors, items, etc.)
    const nearbyEntities = ecsManager.queryEntities('Position', 'Tag');
    
    for (const entityId of nearbyEntities) {
      if (entityId === this.playerEntityId) continue;
      
      const entityPos = ecsManager.getComponent(entityId, 'Position');
      const tag = ecsManager.getComponent(entityId, 'Tag');
      
      if (entityPos && tag) {
        const distance = Math.sqrt(
          Math.pow(entityPos.x - playerPos.x, 2) + 
          Math.pow(entityPos.y - playerPos.y, 2)
        );
        
        if (distance <= 1.5) { // Adjacent tiles
          if (tag.name === 'door') {
            this.interactWithDoor(ecsManager, entityId);
          } else if (tag.name === 'item') {
            this.pickupItem(ecsManager, entityId);
          }
        }
      }
    }
  }
  
  private interactWithDoor(ecsManager: ECSManager, doorId: number): void {
    const door = ecsManager.getComponent(doorId, 'Door');
    const collision = ecsManager.getComponent(doorId, 'Collision');
    
    if (door && collision) {
      if (!door.locked) {
        door.open = !door.open;
        collision.solid = !door.open;
        console.log(`Door ${door.open ? 'opened' : 'closed'}`);
      } else {
        console.log('Door is locked!');
      }
    }
  }
  
  private pickupItem(ecsManager: ECSManager, itemId: number): void {
    const playerInventory = ecsManager.getComponent(this.playerEntityId!, 'Inventory');
    const item = ecsManager.getComponent(itemId, 'Item');
    
    if (playerInventory && item) {
      if (playerInventory.items.length < playerInventory.capacity) {
        const inventoryItem: InventoryItem = {
          id: `item_${this.nextItemId++}`,
          itemType: item.itemType,
          quantity: item.quantity,
          stackable: item.stackable,
          properties: item.properties
        };
        playerInventory.items.push(inventoryItem);
        ecsManager.removeEntity(itemId); // Remove item from world
        console.log(`Picked up ${item.itemType}`);
      } else {
        console.log('Inventory is full!');
      }
    }
  }
  
  private handleAttack(ecsManager: ECSManager, playerPos: { x: number; y: number }): void {
    // Find attackable entities nearby (enemies)
    const nearbyEntities = ecsManager.queryEntities('Position', 'Tag', 'Health');
    
    for (const entityId of nearbyEntities) {
      if (entityId === this.playerEntityId) continue;
      
      const entityPos = ecsManager.getComponent(entityId, 'Position');
      const tag = ecsManager.getComponent(entityId, 'Tag');
      
      if (entityPos && tag && tag.name === 'enemy') {
        const distance = Math.sqrt(
          Math.pow(entityPos.x - playerPos.x, 2) + 
          Math.pow(entityPos.y - playerPos.y, 2)
        );
        
        if (distance <= 1.5) { // Adjacent tiles
          const health = ecsManager.getComponent(entityId, 'Health');
          if (health) {
            health.current -= 10; // Deal 10 damage
            console.log(`Attacked enemy for 10 damage! Enemy health: ${health.current}/${health.max}`);
            
            if (health.current <= 0) {
              ecsManager.removeEntity(entityId);
              console.log('Enemy defeated!');
            }
          }
        }
      }
    }
  }
  
  update(ecsManager: ECSManager, deltaTime: number): void {
    // In turn-based game, this is called when processing a turn
    // The actual movement happens in processTurn()
  }
}
