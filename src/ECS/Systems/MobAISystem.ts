// Systems/MobAISystem.ts
// Handles AI behavior for mob entities (turn-based)

import { System } from '../System';
import { ECSManager } from '../ECSManager';
import { componentFactories } from '../ComponentRegistry';

export class MobAISystem extends System {
  private playerPosition?: { x: number; y: number };
  
  constructor() {
    super(['Mob', 'Position', 'Health']);
  }
  
  setPlayerPosition(x: number, y: number): void {
    this.playerPosition = { x, y };
  }
  
  update(ecsManager: ECSManager, deltaTime: number): void {
    if (!this.playerPosition) return;
    
    const mobEntities = this.getEntities(ecsManager);
    
    mobEntities.forEach(entityId => {
      const mob = ecsManager.getComponent(entityId, 'Mob');
      const position = ecsManager.getComponent(entityId, 'Position');
      const health = ecsManager.getComponent(entityId, 'Health');
      
      if (!mob || !position || !health) return;
      
      // Skip dead mobs
      if (health.current <= 0) return;
      
      // Handle cooldown
      if (mob.moveCooldown > 0) {
        mob.moveCooldown--;
        return;
      }
      
      const distanceToPlayer = this.calculateDistance(position, this.playerPosition!);
      
      // Simple AI state machine for turn-based movement
      switch (mob.aiState) {
        case 'idle':
          if (distanceToPlayer <= 5) {
            // Player detected, switch to chase
            mob.aiState = 'chase';
            mob.lastPlayerX = this.playerPosition?.x;
            mob.lastPlayerY = this.playerPosition?.y;
          }
          break;
          
        case 'chase':
          if (distanceToPlayer > 10) {
            // Lost player, go back to patrol
            mob.aiState = 'patrol';
          } else if (distanceToPlayer <= 1) {
            // Close enough to attack
            mob.aiState = 'attack';
          } else {
            // Move towards player (one step per turn)
            this.moveTowards(ecsManager, entityId, this.playerPosition!);
            mob.moveCooldown = 1; // Wait one turn before next move
          }
          break;
          
        case 'attack':
          if (distanceToPlayer > 1.5) {
            // Player moved away, chase again
            mob.aiState = 'chase';
          } else {
            // Attack player
            this.attackPlayer(ecsManager, entityId);
            mob.moveCooldown = 2; // Wait 2 turns after attacking
          }
          break;
          
        case 'patrol':
          if (distanceToPlayer <= 5) {
            // Player detected again
            mob.aiState = 'chase';
          } else {
            // Simple patrol movement (random walk)
            this.patrol(ecsManager, entityId);
            mob.moveCooldown = 1; // Wait one turn before next move
          }
          break;
      }
    });
  }
  
  private calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  private moveTowards(ecsManager: ECSManager, entityId: number, target: { x: number; y: number }): void {
    const position = ecsManager.getComponent(entityId, 'Position');
    
    if (!position) return;
    
    // Calculate best direction towards target (Manhattan distance for turn-based)
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    
    let newX = position.x;
    let newY = position.y;
    
    // Move in the direction that reduces distance most
    if (Math.abs(dx) > Math.abs(dy)) {
      newX += dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      newY += dy > 0 ? 1 : -1;
    }
    
    // Check if move is valid
    if (this.canMoveTo(ecsManager, newX, newY)) {
      position.x = newX;
      position.y = newY;
    }
  }
  
  private patrol(ecsManager: ECSManager, entityId: number): void {
    const position = ecsManager.getComponent(entityId, 'Position');
    
    if (!position) return;
    
    // Try random directions until one works
    const directions = [
      { x: 0, y: -1 }, // up
      { x: 0, y: 1 },  // down
      { x: -1, y: 0 }, // left
      { x: 1, y: 0 },  // right
    ];
    
    // Shuffle directions
    const shuffled = directions.sort(() => Math.random() - 0.5);
    
    for (const dir of shuffled) {
      const newX = position.x + dir.x;
      const newY = position.y + dir.y;
      
      if (this.canMoveTo(ecsManager, newX, newY)) {
        position.x = newX;
        position.y = newY;
        break;
      }
    }
  }
  
  private attackPlayer(ecsManager: ECSManager, mobId: number): void {
    // Find player entity
    const playerEntities = ecsManager.queryEntities('Tag').filter(id => 
      ecsManager.getComponent(id, 'Tag')?.name === 'player'
    );
    
    if (playerEntities.length > 0) {
      const playerId = playerEntities[0];
      const playerHealth = ecsManager.getComponent(playerId, 'Health');
      
      if (playerHealth) {
        playerHealth.current -= 10; // Deal 10 damage
        console.log(`Mob attacked player for 10 damage! Player health: ${playerHealth.current}/${playerHealth.max}`);
      }
    }
  }
  
  private canMoveTo(ecsManager: ECSManager, x: number, y: number): boolean {
    // Get all entities with collision at target position
    const collisionEntities = ecsManager.queryEntities('Collision', 'Position');
    
    for (const entityId of collisionEntities) {
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
}
