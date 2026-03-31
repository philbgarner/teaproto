// ComponentManager.ts
// Manages all component storages and provides type-safe operations

import { ComponentStorage } from './ComponentStorage';
import { ComponentType, ComponentData, ComponentMap } from './ComponentRegistry';

export class ComponentManager {
  private storages = new Map<ComponentType, ComponentStorage<any>>();
  
  // Type-safe component addition
  addComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T, 
    component: ComponentData<T>
  ): void {
    if (!this.storages.has(componentType)) {
      this.storages.set(componentType, new ComponentStorage<ComponentData<T>>());
    }
    this.storages.get(componentType)!.add(entityId, component);
  }
  
  // Type-safe component retrieval
  getComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T
  ): ComponentData<T> | undefined {
    const storage = this.storages.get(componentType);
    return storage ? storage.get(entityId) : undefined;
  }
  
  // Type-safe component checking
  hasComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T
  ): boolean {
    const storage = this.storages.get(componentType);
    return storage ? storage.has(entityId) : false;
  }
  
  // Type-safe component removal
  removeComponent<T extends ComponentType>(
    entityId: number, 
    componentType: T
  ): boolean {
    const storage = this.storages.get(componentType);
    return storage ? storage.remove(entityId) : false;
  }
  
  // Get entities with multiple components (type-safe)
  getEntitiesWithComponents<T extends ComponentType>(
    ...componentTypes: T[]
  ): number[] {
    if (componentTypes.length === 0) return [];
    
    const [firstType, ...restTypes] = componentTypes;
    const firstStorage = this.storages.get(firstType);
    
    if (!firstStorage) return [];
    
    return firstStorage.getEntityIds().filter(entityId =>
      restTypes.every(type => this.hasComponent(entityId, type))
    );
  }
  
  // Get all entities with a specific component type
  getEntitiesWithComponent<T extends ComponentType>(
    componentType: T
  ): number[] {
    const storage = this.storages.get(componentType);
    return storage ? storage.getEntityIds() : [];
  }
  
  // Remove all components for an entity (called when entity is destroyed)
  removeAllComponents(entityId: number): void {
    this.storages.forEach(storage => {
      storage.remove(entityId);
    });
  }
  
  // Get all components of a specific type (useful for debugging)
  getAllComponents<T extends ComponentType>(
    componentType: T
  ): Array<[number, ComponentData<T>]> {
    const storage = this.storages.get(componentType);
    return storage ? storage.getAll() as Array<[number, ComponentData<T>]> : [];
  }
  
  // Clear all components (useful for resetting the world)
  clear(): void {
    this.storages.forEach(storage => storage.clear());
  }
  
  // Get storage statistics (useful for debugging)
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.storages.forEach((storage, componentType) => {
      stats[componentType] = storage.size();
    });
    return stats;
  }
}
