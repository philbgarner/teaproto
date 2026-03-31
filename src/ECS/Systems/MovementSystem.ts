// Systems/MovementSystem.ts
// Handles entity movement based on velocity components

import { System } from '../System';
import { ECSManager } from '../ECSManager';

export class MovementSystem extends System {
  constructor() {
    super(['Position', 'Velocity']);
  }
  
  update(ecsManager: ECSManager, deltaTime: number): void {
    const movableEntities = this.getEntities(ecsManager);
    
    movableEntities.forEach(entityId => {
      const position = ecsManager.getComponent(entityId, 'Position');
      const velocity = ecsManager.getComponent(entityId, 'Velocity');
      
      if (position && velocity) {
        // Update position based on velocity
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;
      }
    });
  }
}
