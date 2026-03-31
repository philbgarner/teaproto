// index.ts
// Main export file for the ECS system

// Core classes
export { ECSManager } from './ECSManager';
export { ComponentManager } from './ComponentManager';
export { ComponentStorage } from './ComponentStorage';
export { System } from './System';

// Component registry and types
export {
  ComponentMap,
  ComponentType,
  ComponentData,
  Position,
  Health,
  Inventory,
  Renderable,
  Door,
  Tag,
  Mob,
  Item,
  Collision,
  componentFactories,
  TAGS,
  TagType,
} from './ComponentRegistry';

// Systems
export { MovementSystem } from './Systems/MovementSystem';
export { RenderSystem } from './Systems/RenderSystem';
export { MobAISystem } from './Systems/MobAISystem';
export { PlayerInputSystem, PlayerInput, BufferedInput } from './Systems/PlayerInputSystem';

// Factories
export {
  createPlayer,
  createMob,
  createDoor,
  createItem,
  createWall,
} from './Factories/EntityFactory';
