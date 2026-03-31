// Factories/EntityFactory.ts
// Factory functions for creating common entity types

import { ECSManager } from '../ECSManager';
import { componentFactories, TAGS } from '../ComponentRegistry';

export function createPlayer(ecsManager: ECSManager, x: number, y: number): number {
  const playerId = ecsManager.createEntity();
  
  ecsManager.addComponent(playerId, 'Position', componentFactories.Position(x, y));
  ecsManager.addComponent(playerId, 'Health', componentFactories.Health(100));
  ecsManager.addComponent(playerId, 'Inventory', componentFactories.Inventory(20));
  ecsManager.addComponent(playerId, 'Renderable', componentFactories.Renderable('player_texture', 1));
  ecsManager.addComponent(playerId, 'Tag', componentFactories.Tag(TAGS.PLAYER));
  ecsManager.addComponent(playerId, 'Collision', componentFactories.Collision(true, 0.8, 0.8));
    
  return playerId;
}

export function createMob(
  ecsManager: ECSManager, 
  x: number, 
  y: number, 
  type: string,
  health = 50
): number {
  const mobId = ecsManager.createEntity();
  
  ecsManager.addComponent(mobId, 'Position', componentFactories.Position(x, y));
  ecsManager.addComponent(mobId, 'Health', componentFactories.Health(health));
  ecsManager.addComponent(mobId, 'Renderable', componentFactories.Renderable(`${type}_texture`, 1));
  ecsManager.addComponent(mobId, 'Tag', componentFactories.Tag(TAGS.ENEMY));
  ecsManager.addComponent(mobId, 'Mob', componentFactories.Mob(type));
  ecsManager.addComponent(mobId, 'Collision', componentFactories.Collision(true, 0.8, 0.8));
  
  return mobId;
}

export function createDoor(
  ecsManager: ECSManager, 
  x: number, 
  y: number, 
  locked = false, 
  keyId?: string
): number {
  const doorId = ecsManager.createEntity();
  
  ecsManager.addComponent(doorId, 'Position', componentFactories.Position(x, y));
  ecsManager.addComponent(doorId, 'Renderable', componentFactories.Renderable('door_texture', 0));
  ecsManager.addComponent(doorId, 'Door', componentFactories.Door(false, locked, keyId));
  ecsManager.addComponent(doorId, 'Tag', componentFactories.Tag(TAGS.DOOR));
  ecsManager.addComponent(doorId, 'Collision', componentFactories.Collision(!locked, 1, 1));
    
  return doorId;
}

export function createItem(
  ecsManager: ECSManager,
  x: number,
  y: number,
  itemType: string,
  quantity = 1
): number {
  const itemId = ecsManager.createEntity();
  
  ecsManager.addComponent(itemId, 'Position', componentFactories.Position(x, y));
  ecsManager.addComponent(itemId, 'Renderable', componentFactories.Renderable(`${itemType}_texture`, 2));
  ecsManager.addComponent(itemId, 'Tag', componentFactories.Tag(TAGS.ITEM));
  ecsManager.addComponent(itemId, 'Item', componentFactories.Item(itemType, true, quantity));
  ecsManager.addComponent(itemId, 'Collision', componentFactories.Collision(false, 0.5, 0.5));
  
  return itemId;
}

export function createWall(
  ecsManager: ECSManager,
  x: number,
  y: number,
  texture = 'wall_texture'
): number {
  const wallId = ecsManager.createEntity();
  
  ecsManager.addComponent(wallId, 'Position', componentFactories.Position(x, y));
  ecsManager.addComponent(wallId, 'Renderable', componentFactories.Renderable(texture, 0));
  ecsManager.addComponent(wallId, 'Tag', componentFactories.Tag(TAGS.WALL));
  ecsManager.addComponent(wallId, 'Collision', componentFactories.Collision(true, 1, 1));
  
  return wallId;
}
