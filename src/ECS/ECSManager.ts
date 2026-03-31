// ECSManager.ts
// Core ECS manager that handles entities, components, and systems

import { ComponentManager } from './ComponentManager';
import { System } from './System';
import { ComponentType, ComponentData } from './ComponentRegistry';

export class ECSManager {
  private entities = new Set<number>();
  private systems: System[] = [];
  private componentManager = new ComponentManager();
  private nextEntityId = 0;
  private entitiesToRemove = new Set<number>();
  
  createEntity(): number {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }
  
  // Schedule entity for removal (deferred to avoid iteration issues)
  removeEntity(entityId: number): void {
    this.entitiesToRemove.add(entityId);
  }
  
  // Process scheduled removals (call this at the end of each frame)
  private processRemovals(): void {
    this.entitiesToRemove.forEach(entityId => {
      this.entities.delete(entityId);
      this.componentManager.removeAllComponents(entityId);
    });
    this.entitiesToRemove.clear();
  }
  
  // Type-safe component addition
  addComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T, 
    component: ComponentData<T>
  ): void {
    this.componentManager.addComponent(entityId, componentType, component);
  }
  
  // Type-safe component retrieval
  getComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T
  ): ComponentData<T> | undefined {
    return this.componentManager.getComponent(entityId, componentType);
  }
  
  // Type-safe component checking
  hasComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T
  ): boolean {
    return this.componentManager.hasComponent(entityId, componentType);
  }
  
  // Type-safe component removal
  removeComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T
  ): boolean {
    return this.componentManager.removeComponent(entityId, componentType);
  }
  
  // Type-safe entity queries
  queryEntities<T extends ComponentType>(
    ...componentClasses: T[]
  ): number[] {
    return this.componentManager.getEntitiesWithComponents(...componentClasses);
  }
  
  queryEntitiesWithComponent<T extends ComponentType>(
    componentClass: T
  ): number[] {
    return this.componentManager.getEntitiesWithComponent(componentClass);
  }
  
  // System management
  addSystem(system: System): void {
    this.systems.push(system);
  }
  
  removeSystem(system: System): void {
    const index = this.systems.indexOf(system);
    if (index !== -1) {
      this.systems.splice(index, 1);
    }
  }
  
  // Main update loop
  update(deltaTime: number): void {
    // Update all systems
    this.systems.forEach(system => {
      system.update(this, deltaTime);
    });
    
    // Process any scheduled entity removals
    this.processRemovals();
  }
  
  // Get all active entities
  getActiveEntities(): number[] {
    return Array.from(this.entities);
  }
  
  // Check if entity is still active
  isEntityActive(entityId: number): boolean {
    return this.entities.has(entityId);
  }
  
  // Get component statistics (useful for debugging)
  getComponentStats(): Record<string, number> {
    return this.componentManager.getStats();
  }
  
  // Clear everything (useful for resetting the game)
  clear(): void {
    this.entities.clear();
    this.entitiesToRemove.clear();
    this.componentManager.clear();
    this.systems = [];
    this.nextEntityId = 0;
  }
}
