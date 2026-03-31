// Systems/RenderSystem.ts
// Handles rendering of entities with renderable components

import { System } from '../System';
import { ECSManager } from '../ECSManager';

// This would be implemented based on your rendering engine
interface RenderContext {
  clear(): void;
  drawTexture(texture: string, x: number, y: number, layer: number): void;
  flush(): void;
}

export class RenderSystem extends System {
  constructor(private renderContext: RenderContext) {
    super(['Renderable', 'Position']);
  }
  
  update(ecsManager: ECSManager, deltaTime: number): void {
    const renderableEntities = this.getEntities(ecsManager);
    
    // Sort by layer for proper rendering order
    renderableEntities.sort((a, b) => {
      const aLayer = ecsManager.getComponent(a, 'Renderable')?.layer ?? 0;
      const bLayer = ecsManager.getComponent(b, 'Renderable')?.layer ?? 0;
      return aLayer - bLayer;
    });
    
    this.renderContext.clear();
    
    renderableEntities.forEach(entityId => {
      const renderable = ecsManager.getComponent(entityId, 'Renderable');
      const position = ecsManager.getComponent(entityId, 'Position');
      
      if (renderable && position && renderable.visible) {
        this.renderContext.drawTexture(
          renderable.texture, 
          position.x, 
          position.y, 
          renderable.layer
        );
      }
    });
    
    this.renderContext.flush();
  }
}
