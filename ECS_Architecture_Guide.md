# ECS Architecture Implementation Guide

## Overview
This guide outlines how to implement an Entity Component System (ECS) architecture for handling game objects like entities (player, mobs), items, inventory, doors, and environment behavior.

## Two Implementation Approaches

### 1. Object-Based Entities (Beginner-Friendly)
- Entities are objects with component maps
- More intuitive and easier to debug
- Good for smaller games and prototyping

### 2. ID-Based Entities (Performance-Optimized) ⭐ **Recommended**
- Entities are simple numeric IDs
- Better memory efficiency and performance
- More "pure" ECS implementation
- Better for large-scale games

This guide focuses on the **ID-based approach** for better scalability.

## ID-Based ECS Structure

### 1. Entity as Simple ID
```javascript
// Entity.js
let nextEntityId = 0;

export const createEntity = () => nextEntityId++;
export const removeEntity = (id) => { /* cleanup logic */ };
```

### 2. Component Storage (Type-Safe)
```typescript
// Components/ComponentStorage.ts
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
}
```

### 3. Component Manager (Type-Safe)
```typescript
// ComponentManager.ts
export class ComponentManager {
  private storages = new Map<string, ComponentStorage<any>>();
  
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
}
```

### 4. Component Definitions (Plain Data Types)

**Important Principle**: Components should be plain data objects with NO logic - just data containers.

#### Position Component
```typescript
// Components/Position.ts
export interface Position {
  x: number;
  y: number;
}

// Factory function for creation
export const createPosition = (x = 0, y = 0): Position => ({ x, y });
```

#### Velocity Component
```typescript
// Components/Velocity.ts
export interface Velocity {
  x: number;
  y: number;
}

export const createVelocity = (x = 0, y = 0): Velocity => ({ x, y });
```

#### Health Component
```typescript
// Components/Health.ts
export interface Health {
  max: number;
  current: number;
}

export const createHealth = (max: number, current?: number): Health => ({
  max,
  current: current ?? max
});
```

#### Inventory Component
```typescript
// Components/Inventory.ts
export interface Inventory {
  items: string[]; // Item IDs
  capacity: number;
}

export const createInventory = (capacity = 10): Inventory => ({
  items: [],
  capacity
});
```

#### Renderable Component
```typescript
// Components/Renderable.ts
export interface Renderable {
  texture: string;
  layer: number;
  visible: boolean;
}

export const createRenderable = (
  texture: string, 
  layer = 0, 
  visible = true
): Renderable => ({ texture, layer, visible });
```

#### Door Component
```typescript
// Components/Door.ts
export interface Door {
  open: boolean;
  locked: boolean;
  keyId?: string;
}

export const createDoor = (
  open = false, 
  locked = false, 
  keyId?: string
): Door => ({ open, locked, keyId });
```

#### Tag Component
```typescript
// Components/Tag.ts
export interface Tag {
  name: string;
}

export const createTag = (name: string): Tag => ({ name });
```

### Component Registry (Type-Safe Component Management)
```typescript
// ComponentRegistry.ts
export interface ComponentMap {
  Position: Position;
  Velocity: Velocity;
  Health: Health;
  Inventory: Inventory;
  Renderable: Renderable;
  Door: Door;
  Tag: Tag;
}

export type ComponentType = keyof ComponentMap;
export type ComponentData<T extends ComponentType> = ComponentMap[T];

// Type-safe component creation
export const componentFactories = {
  Position: createPosition,
  Velocity: createVelocity,
  Health: createHealth,
  Inventory: createInventory,
  Renderable: createRenderable,
  Door: createDoor,
  Tag: createTag,
} as const;
```

### 5. System Architecture

#### Base System
```javascript
// System.js
export class System {
  constructor(requiredComponents = []) {
    this.requiredComponents = requiredComponents;
  }
  
  update(ecsManager, deltaTime) {
    // Override in subclasses
  }
}
```

#### Movement System
```javascript
// Systems/MovementSystem.js
export class MovementSystem extends System {
  constructor() {
    super([Position, Velocity]);
  }
  
  update(ecsManager, deltaTime) {
    // Get all entities with Position and Velocity components
    const movableEntities = ecsManager.queryEntities(Position, Velocity);
    
    movableEntities.forEach(entityId => {
      const position = ecsManager.getComponent(entityId, Position);
      const velocity = ecsManager.getComponent(entityId, Velocity);
      
      position.x += velocity.x * deltaTime;
      position.y += velocity.y * deltaTime;
    });
  }
}
```

#### Render System
```javascript
// Systems/RenderSystem.js
export class RenderSystem extends System {
  constructor() {
    super([Renderable, Position]);
  }
  
  update(ecsManager, deltaTime) {
    const renderableEntities = ecsManager.queryEntities(Renderable, Position);
    
    // Sort by layer for proper rendering order
    renderableEntities.sort((a, b) => {
      const aLayer = ecsManager.getComponent(a, Renderable).layer;
      const bLayer = ecsManager.getComponent(b, Renderable).layer;
      return aLayer - bLayer;
    });
    
    renderableEntities.forEach(entityId => {
      const renderable = ecsManager.getComponent(entityId, Renderable);
      const position = ecsManager.getComponent(entityId, Position);
      
      if (renderable.visible) {
        // Render entity at position
        this.render(renderable.texture, position.x, position.y);
      }
    });
  }
}
```

#### Inventory System
```javascript
// Systems/InventorySystem.js
export class InventorySystem extends System {
  constructor() {
    super([Inventory]);
  }
  
  addItem(ecsManager, entityId, item) {
    const inventory = ecsManager.getComponent(entityId, Inventory);
    if (inventory.items.length < inventory.capacity) {
      inventory.items.push(item);
      return true;
    }
    return false;
  }
  
  removeItem(ecsManager, entityId, itemId) {
    const inventory = ecsManager.getComponent(entityId, Inventory);
    const index = inventory.items.findIndex(item => item.id === itemId);
    if (index !== -1) {
      return inventory.items.splice(index, 1)[0];
    }
    return null;
  }
}
```

### 6. ECS Manager (Type-Safe)
```typescript
// ECSManager.ts
export class ECSManager {
  private entities = new Set<number>();
  private systems: System[] = [];
  private componentManager = new ComponentManager();
  private nextEntityId = 0;
  
  createEntity(): number {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }
  
  removeEntity(entityId: number): void {
    this.entities.delete(entityId);
    // Remove all components for this entity
    // This is handled automatically by ComponentManager cleanup
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
  
  addSystem(system: System): void {
    this.systems.push(system);
  }
  
  update(deltaTime: number): void {
    this.systems.forEach(system => {
      system.update(this, deltaTime);
    });
  }
}
```

## Game-Specific Implementation (Type-Safe)

### Player Entity Factory
```typescript
// Factories/PlayerFactory.ts
export function createPlayer(ecsManager: ECSManager, x: number, y: number): number {
  const playerId = ecsManager.createEntity();
  
  ecsManager.addComponent(playerId, 'Position', createPosition(x, y));
  ecsManager.addComponent(playerId, 'Velocity', createVelocity(0, 0));
  ecsManager.addComponent(playerId, 'Health', createHealth(100));
  ecsManager.addComponent(playerId, 'Inventory', createInventory(20));
  ecsManager.addComponent(playerId, 'Renderable', createRenderable('player_texture', 1));
  ecsManager.addComponent(playerId, 'Tag', createTag('player'));
    
  return playerId;
}
```

### Mob Entity Factory
```typescript
// Factories/MobFactory.ts
export function createMob(
  ecsManager: ECSManager, 
  x: number, 
  y: number, 
  type: string
): number {
  const mobId = ecsManager.createEntity();
  
  ecsManager.addComponent(mobId, 'Position', createPosition(x, y));
  ecsManager.addComponent(mobId, 'Velocity', createVelocity(0, 0));
  ecsManager.addComponent(mobId, 'Health', createHealth(50));
  ecsManager.addComponent(mobId, 'Renderable', createRenderable(`${type}_texture`, 1));
  ecsManager.addComponent(mobId, 'Tag', createTag('enemy'));
  
  return mobId;
}
```

### Door Entity Factory
```typescript
// Factories/DoorFactory.ts
export function createDoor(
  ecsManager: ECSManager, 
  x: number, 
  y: number, 
  locked = false, 
  keyId?: string
): number {
  const doorId = ecsManager.createEntity();
  
  ecsManager.addComponent(doorId, 'Position', createPosition(x, y));
  ecsManager.addComponent(doorId, 'Renderable', createRenderable('door_texture', 0));
  ecsManager.addComponent(doorId, 'Door', createDoor(false, locked, keyId));
  ecsManager.addComponent(doorId, 'Tag', createTag('door'));
    
  return doorId;
}
```

## Integration with React

```javascript
// hooks/useECS.js
import { useState, useEffect } from 'react';

export function useECS() {
  const [ecsManager] = useState(() => new ECSManager());
  
  useEffect(() => {
    // Initialize systems
    ecsManager.addSystem(new MovementSystem());
    ecsManager.addSystem(new RenderSystem());
    ecsManager.addSystem(new InventorySystem());
    ecsManager.addSystem(new AISystem());
    ecsManager.addSystem(new CombatSystem());
    
    // Create initial entities
    createPlayer(ecsManager, 10, 10);
    createMob(ecsManager, 20, 20, 'goblin');
    createDoor(ecsManager, 15, 15, true, 'door_key_1');
  }, []);
  
  return ecsManager;
}
```

## Advanced Features

### 1. Event System
```javascript
// EventSystem.js
export class EventSystem extends System {
  constructor() {
    super();
    this.listeners = new Map();
  }
  
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }
  
  emit(eventType, data) {
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach(callback => callback(data));
  }
}
```

### 2. Component Tags (Type-Safe)
```typescript
// Components/Tag.ts
export interface Tag {
  name: string;
}

export const createTag = (name: string): Tag => ({ name });

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
```

### 3. Serialization (Type-Safe)
```typescript
// Serialization.ts
export function serializeEntity(ecsManager: ECSManager, entityId: number): {
  id: number;
  components: Record<string, any>;
} {
  const data: { id: number; components: Record<string, any> } = {
    id: entityId,
    components: {},
  };
  
  // Serialize all components for this entity
  Object.values(COMPONENT_TYPES).forEach(componentType => {
    const component = ecsManager.getComponent(entityId, componentType);
    if (component) {
      data.components[componentType] = { ...component };
    }
  });
  
  return data;
}

export function deserializeEntity(
  ecsManager: ECSManager, 
  entityData: { id: number; components: Record<string, any> }
): number {
  const entityId = ecsManager.createEntity();
  
  // Restore all components
  Object.entries(entityData.components).forEach(([componentType, componentData]) => {
    if (componentType in componentFactories) {
      // Use factory function to create component with restored data
      const component = Object.assign({}, componentData);
      ecsManager.addComponent(entityId, componentType as ComponentType, component);
    }
  });
  
  return entityId;
}
```

### 4. Performance-Optimized Component Arrays
```javascript
// Components/ComponentArray.js
export class ComponentArray {
  constructor() {
    this.data = []; // Array of component instances
    this.entityToIndex = new Map(); // entityId -> index in data array
  }
  
  add(entityId, component) {
    const index = this.data.length;
    this.data.push(component);
    this.entityToIndex.set(entityId, index);
  }
  
  get(entityId) {
    const index = this.entityToIndex.get(entityId);
    return index !== undefined ? this.data[index] : null;
  }
}
```

## Benefits of Type-Safe ECS with Plain Data Components

### **Performance Benefits**
- **Memory Efficiency**: Plain objects instead of classes with prototypes
- **Cache Locality**: Better CPU cache performance with simple data structures
- **Faster Iteration**: Direct property access vs method calls
- **Scalability**: Handles thousands of entities efficiently

### **Type Safety Benefits**
- **Compile-Time Safety**: Catch errors before runtime
- **IntelliSense**: Better IDE support and autocomplete
- **Refactoring**: Safe code refactoring with type checking
- **Documentation**: Types serve as living documentation

### **Design Benefits**
- **Data-Oriented**: Clear separation of data and behavior
- **Immutability**: Easy to create immutable components
- **Serialization**: Simple JSON serialization of plain objects
- **Testing**: Easy to test with simple data structures

### **Development Benefits**
- **Debugging**: Easier to inspect plain data vs complex objects
- **Networking**: Simple to sync plain data across clients
- **Modularity**: Components can be developed independently
- **Maintainability**: Clear, predictable component structure

## Comparison: Class-Based vs Type-Based Components

| Aspect | Class-Based | Type-Based ⭐ |
|--------|-------------|------------|
| Memory Usage | Higher | Lower |
| Performance | Good | Excellent |
| Type Safety | Runtime | Compile-Time |
| Debugging | Complex | Simple |
| Serialization | Complex | Simple |
| Learning Curve | Moderate | Easier |
| IDE Support | Good | Excellent |
| Refactoring | Risky | Safe |

## Component Design Principles

### **✅ Good Component Design**
```typescript
// Plain data - no logic
export interface Position {
  x: number;
  y: number;
}

// Simple factory function
export const createPosition = (x = 0, y = 0): Position => ({ x, y });
```

### **❌ Bad Component Design**
```typescript
// AVOID: Logic in components
export class Position {
  constructor(private x: number, private y: number) {}
  
  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }
  
  distanceTo(other: Position): number {
    return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
  }
}
```

### **✅ Correct Approach: Logic in Systems**
```typescript
// MovementSystem.ts - contains the logic
export class MovementSystem extends System {
  update(ecsManager: ECSManager, deltaTime: number): void {
    const movableEntities = ecsManager.queryEntities('Position', 'Velocity');
    
    movableEntities.forEach(entityId => {
      const position = ecsManager.getComponent(entityId, 'Position')!;
      const velocity = ecsManager.getComponent(entityId, 'Velocity')!;
      
      // Logic belongs here, not in components
      position.x += velocity.x * deltaTime;
      position.y += velocity.y * deltaTime;
    });
  }
}
```

## Integration with Existing Systems

This ECS can be integrated with your existing dungeon generation system by:

1. **Creating entities for dungeon features**: Doors, items, mobs, traps
2. **Using Position component**: Place entities in dungeon coordinates
3. **Leveraging RenderSystem**: Handle visual representation
4. **Using EventSystem**: Handle dungeon interactions
5. **Serialization**: Save/load dungeon states with entities

### Example: Dungeon Integration
```javascript
// Create entities from dungeon data
dungeon.rooms.forEach(room => {
  // Add doors
  room.doors.forEach(door => {
    createDoor(ecsManager, door.x, door.y, door.locked, door.keyId);
  });
  
  // Add items
  room.items.forEach(item => {
    createItem(ecsManager, item.x, item.y, item.type);
  });
  
  // Add mobs
  room.mobs.forEach(mob => {
    createMob(ecsManager, mob.x, mob.y, mob.type);
  });
});
```

## Implementation Steps

1. **Set up TypeScript**: Configure tsconfig.json for strict type checking
2. **Create component interfaces**: Define all components as plain data types
3. **Implement ComponentManager**: Type-safe component storage and retrieval
4. **Create ECSManager**: Core entity and system management
5. **Implement essential systems**: Movement, Render, Collision with type safety
6. **Create entity factories**: Type-safe factory functions for common entities
7. **Integrate with existing systems**: Dungeon generation, rendering pipeline
8. **Add advanced features**: Events, serialization, networking
9. **Optimize performance**: Component arrays, batch processing, memory pools

## Next Steps

1. **Start with TypeScript**: Enable strict mode for best type safety
2. **Define core components**: Position, Velocity, Health, etc. as interfaces
3. **Implement the type-safe ECSManager**: Following the patterns above
4. **Create basic systems**: Movement and rendering as examples
5. **Gradually integrate**: Start with simple entities and expand
6. **Test thoroughly**: Leverage type safety for better testing

## Why This Approach is Superior

### **Pure ECS Philosophy**
- **Components = Data**: Plain objects, no methods, no logic
- **Systems = Behavior**: All logic lives in systems
- **Entities = IDs**: Simple identifiers that link components together

### **TypeScript Advantages**
- **Compile-Time Safety**: Catch component type mismatches early
- **IntelliSense**: Auto-complete for component properties
- **Refactoring**: Safe renaming and restructuring
- **Documentation**: Types serve as living documentation

### **Performance Benefits**
- **Memory Efficiency**: No class overhead, just plain objects
- **Cache Performance**: Better data locality
- **Serialization**: Native JSON support
- **Network Sync**: Easy to send component data

This type-safe, data-oriented ECS architecture provides the best of both worlds: excellent performance and compile-time safety. It's particularly well-suited for complex games with many entities and interactions, while maintaining clean, maintainable code that's easy to debug and extend.

The key insight is that **components should be dumb data containers** - all the logic belongs in systems. This separation makes the code more predictable, testable, and performant.
