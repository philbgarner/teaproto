// ComponentStorage.ts
// Type-safe storage for a specific component type

export class ComponentStorage<T> {
  private components = new Map<number, T>();
  
  add(entityId: number, component: T): void {
    this.components.set(entityId, component);
  }
  
  get(entityId: number): T | undefined {
    return this.components.get(entityId);
  }
  
  has(entityId: number): boolean {
    return this.components.has(entityId);
  }
  
  remove(entityId: number): boolean {
    return this.components.delete(entityId);
  }
  
  getAll(): Array<[number, T]> {
    return Array.from(this.components.entries());
  }
  
  getEntityIds(): number[] {
    return Array.from(this.components.keys());
  }
  
  clear(): void {
    this.components.clear();
  }
  
  size(): number {
    return this.components.size;
  }
}
