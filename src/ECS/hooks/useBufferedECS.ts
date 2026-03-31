// hooks/useBufferedECS.ts
// Turn-based ECS hook with buffered input handling

import { useState, useEffect, useRef, useCallback } from 'react';
import { ECSManager, MovementSystem, RenderSystem, MobAISystem, PlayerInputSystem, BufferedInput } from '../index';

// Mock render context for demonstration
const createMockRenderContext = () => ({
  clear: () => console.log('Clearing render context'),
  drawTexture: (texture: string, x: number, y: number, layer: number) => 
    console.log(`Drawing ${texture} at (${x}, ${y}) layer ${layer}`),
  flush: () => console.log('Flushing render context'),
});

export function useBufferedECS() {
  const [ecsManager] = useState(() => new ECSManager());
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameState, setGameState] = useState<'playing' | 'victory' | 'defeat'>('playing');
  const [bufferStatus, setBufferStatus] = useState<{ count: number; inputs: BufferedInput[] }>({ count: 0, inputs: [] });
  const playerInputSystem = useRef<PlayerInputSystem | null>(null);
  const mobAI = useRef<MobAISystem | null>(null);
  const turnCount = useRef(0);
  const turnDelay = useRef(500); // Milliseconds between turns
  
  // Initialize ECS
  useEffect(() => {
    const renderContext = createMockRenderContext();
    
    // Create systems
    ecsManager.addSystem(new MovementSystem());
    ecsManager.addSystem(new RenderSystem(renderContext));
    mobAI.current = new MobAISystem();
    ecsManager.addSystem(mobAI.current);
    
    // Create player input system with buffering
    playerInputSystem.current = new PlayerInputSystem((newPosition: { x: number; y: number }) => {
      console.log('Player moved to:', newPosition);
      // Trigger enemy turn after player completes all buffered moves
      setTimeout(() => {
        setIsPlayerTurn(false);
      }, turnDelay.current);
    });
    ecsManager.addSystem(playerInputSystem.current);
    
    // Create player
    const playerId = ecsManager.createEntity();
    ecsManager.addComponent(playerId, 'Position', { x: 5, y: 5 });
    ecsManager.addComponent(playerId, 'Health', { max: 100, current: 100 });
    ecsManager.addComponent(playerId, 'Inventory', { items: [], capacity: 20 });
    ecsManager.addComponent(playerId, 'Renderable', { texture: 'player_texture', layer: 1, visible: true });
    ecsManager.addComponent(playerId, 'Tag', { name: 'player' });
    ecsManager.addComponent(playerId, 'Collision', { solid: true, width: 0.8, height: 0.8 });
    
    // Set player entity for input system
    playerInputSystem.current.setPlayerEntity(playerId);
    
    // Set up mob AI
    if (mobAI.current) {
      mobAI.current.setPlayerPosition(5, 5);
    }
    
    // Create some mobs
    for (let i = 0; i < 3; i++) {
      const mobId = ecsManager.createEntity();
      ecsManager.addComponent(mobId, 'Position', { x: 10 + i * 2, y: 10 + i * 2 });
      ecsManager.addComponent(mobId, 'Health', { max: 50, current: 50 });
      ecsManager.addComponent(mobId, 'Renderable', { texture: 'goblin_texture', layer: 1, visible: true });
      ecsManager.addComponent(mobId, 'Tag', { name: 'enemy' });
      ecsManager.addComponent(mobId, 'Mob', { type: 'goblin', aiState: 'idle', moveCooldown: 0 });
      ecsManager.addComponent(mobId, 'Collision', { solid: true, width: 0.8, height: 0.8 });
    }
    
    // Create some walls
    for (let x = 0; x < 15; x++) {
      for (let y = 0; y < 15; y++) {
        if (x === 0 || x === 14 || y === 0 || y === 14) {
          const wallId = ecsManager.createEntity();
          ecsManager.addComponent(wallId, 'Position', { x, y });
          ecsManager.addComponent(wallId, 'Renderable', { texture: 'wall_texture', layer: 0, visible: true });
          ecsManager.addComponent(wallId, 'Tag', { name: 'wall' });
          ecsManager.addComponent(wallId, 'Collision', { solid: true, width: 1, height: 1 });
        }
      }
    }
    
    // Create a door
    const doorId = ecsManager.createEntity();
    ecsManager.addComponent(doorId, 'Position', { x: 7, y: 0 });
    ecsManager.addComponent(doorId, 'Renderable', { texture: 'door_texture', layer: 0, visible: true });
    ecsManager.addComponent(doorId, 'Tag', { name: 'door' });
    ecsManager.addComponent(doorId, 'Door', { open: false, locked: false });
    ecsManager.addComponent(doorId, 'Collision', { solid: true, width: 1, height: 1 });
    
    // Create some items
    const itemPositions = [
      { x: 3, y: 3 },
      { x: 12, y: 8 },
      { x: 7, y: 11 },
    ];
    
    itemPositions.forEach((pos, index) => {
      const itemId = ecsManager.createEntity();
      ecsManager.addComponent(itemId, 'Position', pos);
      ecsManager.addComponent(itemId, 'Renderable', { texture: `item_${index + 1}_texture`, layer: 2, visible: true });
      ecsManager.addComponent(itemId, 'Tag', { name: 'item' });
      ecsManager.addComponent(itemId, 'Item', {
        itemType: `item_${index + 1}`,
        stackable: false,
        quantity: 1,
        usable: true,
        autoPickup: false
      });
      ecsManager.addComponent(itemId, 'Collision', { solid: false, width: 0.5, height: 0.5 });
    });
    
  }, [ecsManager]);
  
  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPlayerTurn || gameState !== 'playing') return;
      
      if (playerInputSystem.current) {
        playerInputSystem.current.handleInput(event);
        
        // Update buffer status for UI
        if (playerInputSystem.current) {
          setBufferStatus(playerInputSystem.current.getBufferStatus());
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ecsManager, isPlayerTurn, gameState]);
  
  // Enemy turn logic
  useEffect(() => {
    if (!isPlayerTurn && gameState === 'playing') {
      const enemyTurn = setTimeout(() => {
        // Process enemy AI
        ecsManager.update(0); // No delta time for turn-based
        
        // Check win/lose conditions
        checkGameConditions();
        
        // Return to player turn
        setIsPlayerTurn(true);
        turnCount.current++;
        
        console.log(`Turn ${turnCount.current} completed`);
      }, turnDelay.current);
      
      return () => clearTimeout(enemyTurn);
    }
  }, [isPlayerTurn, ecsManager, gameState]);
  
  // Check game conditions
  const checkGameConditions = useCallback(() => {
    const playerEntities = ecsManager.queryEntities('Tag').filter(id => 
      ecsManager.getComponent(id, 'Tag')?.name === 'player'
    );
    const enemyEntities = ecsManager.queryEntities('Tag').filter(id => 
      ecsManager.getComponent(id, 'Tag')?.name === 'enemy'
    );
    
    // Check if player is dead
    const player = playerEntities[0];
    if (player) {
      const playerHealth = ecsManager.getComponent(player, 'Health');
      if (playerHealth && playerHealth.current <= 0) {
        setGameState('defeat');
        return;
      }
    }
    
    // Check if all enemies are defeated
    if (enemyEntities.length === 0) {
      setGameState('victory');
    }
  }, [ecsManager]);
  
  // Manual input processing for UI buttons
  const processPlayerTurn = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!isPlayerTurn || gameState !== 'playing' || !playerInputSystem.current) return;
    
    // Simulate key press
    const event = new KeyboardEvent('keydown', { key: direction });
    playerInputSystem.current.handleInput(event);
    
    // Update buffer status
    setBufferStatus(playerInputSystem.current.getBufferStatus());
  }, [ecsManager, isPlayerTurn, gameState]);
  
  const processPlayerAction = useCallback((action: 'interact' | 'attack') => {
    if (!isPlayerTurn || gameState !== 'playing' || !playerInputSystem.current) return;
    
    const key = action === 'interact' ? 'e' : 'f';
    const event = new KeyboardEvent('keydown', { key });
    playerInputSystem.current.handleInput(event);
    
    // Update buffer status
    setBufferStatus(playerInputSystem.current.getBufferStatus());
  }, [ecsManager, isPlayerTurn, gameState]);
  
  // Buffer management functions
  const clearBuffer = useCallback(() => {
    if (playerInputSystem.current) {
      playerInputSystem.current.clearBuffer();
      setBufferStatus({ count: 0, inputs: [] });
    }
  }, []);
  
  const setTurnDelay = useCallback((delay: number) => {
    turnDelay.current = delay;
  }, []);
  
  // Get player position for UI
  const getPlayerPosition = useCallback(() => {
    const playerEntities = ecsManager.queryEntities('Tag').filter(id => 
      ecsManager.getComponent(id, 'Tag')?.name === 'player'
    );
    
    if (playerEntities.length > 0) {
      return ecsManager.getComponent(playerEntities[0], 'Position');
    }
    return null;
  }, [ecsManager]);
  
  // Update buffer status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerInputSystem.current) {
        setBufferStatus(playerInputSystem.current.getBufferStatus());
      }
    }, 100); // Update every 100ms
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    ecsManager,
    isPlayerTurn,
    gameState,
    turnCount: turnCount.current,
    turnDelay: turnDelay.current,
    bufferStatus,
    processPlayerTurn,
    processPlayerAction,
    clearBuffer,
    setTurnDelay,
    getPlayerPosition,
  };
}


/// Example
// function GameComponent() {
//   const { 
//     isPlayerTurn, 
//     bufferStatus, 
//     clearBuffer, 
//     setTurnDelay 
//   } = useBufferedECS();
  
//   return (
//     <div>
//       <div>Turn: {isPlayerTurn ? 'Player' : 'Enemy'}</div>
//       <div>Buffered Actions: {bufferStatus.count}</div>
      
//       {/* Movement preview */}
//       {bufferStatus.inputs.map((input, i) => (
//         <div key={i}>
//           {i + 1}. {input.action} {input.direction}
//         </div>
//       ))}
      
//       <button onClick={() => setTurnDelay(200)}>Fast Mode</button>
//       <button onClick={() => setTurnDelay(1000)}>Slow Mode</button>
//       <button onClick={clearBuffer}>Clear Buffer</button>
//     </div>
//   );
// }