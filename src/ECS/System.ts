// System.ts
// Base system class that all systems should extend

import { ECSManager } from './ECSManager';

export abstract class System {
  protected requiredComponents: string[] = [];
  
  constructor(requiredComponents: string[] = []) {
    this.requiredComponents = requiredComponents;
  }
  
  // Override this method in subclasses
  abstract update(ecsManager: ECSManager, deltaTime: number): void;
  
  // Helper method to get entities that have all required components
  protected getEntities(ecsManager: ECSManager): number[] {
    if (this.requiredComponents.length === 0) {
      // If no components required, return all entities (rare case)
      return []; // Would need entity tracking in ECSManager for this
    }
    
    return ecsManager.queryEntities(...this.requiredComponents as any[]);
  }
  
  // Check if an entity has all required components for this system
  protected canProcess(ecsManager: ECSManager, entityId: number): boolean {
    return this.requiredComponents.every(componentType => 
      ecsManager.hasComponent(entityId, componentType as any)
    );
  }
}
