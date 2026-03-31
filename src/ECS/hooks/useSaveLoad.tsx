// hooks/useSaveLoad.ts
// React hook for save/load functionality

import { useState, useCallback, useEffect } from 'react';
import { ECSManager } from '../ECSManager';
import { SaveSystem, GameState, GlobalGameState, SaveSlotMetadata } from '../Systems/SaveSystem';

export interface SaveLoadHookReturn {
  // Save operations
  saveGame: (slot?: number) => boolean;
  exportGame: (filename?: string) => boolean;
  
  // Load operations  
  loadGame: (slot?: number) => boolean;
  importGame: (file: File) => Promise<boolean>;
  
  // Save slot management
  saveSlots: SaveSlotMetadata[];
  hasSaveSlot: (slot: number) => boolean;
  deleteSaveSlot: (slot: number) => boolean;
  
  // State
  isLoading: boolean;
  lastSaveTime: number | null;
  errorMessage: string | null;
}

export function useSaveLoad(
  ecsManager: ECSManager,
  playerEntityId: number,
  globalState: GlobalGameState,
  onGameLoaded?: (newPlayerId: number, newGlobalState: GlobalGameState) => void
): SaveLoadHookReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSlots, setSaveSlots] = useState<SaveSlotMetadata[]>([]);
  
  // Refresh save slots list
  const refreshSaveSlots = useCallback(() => {
    const slots = SaveSystem.getAllSaveSlots();
    setSaveSlots(slots);
  }, []);
  
  // Save game to localStorage
  const saveGame = useCallback((slot: number = 1) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const success = SaveSystem.saveToLocalStorage(ecsManager, playerEntityId, globalState, slot);
      
      if (success) {
        setLastSaveTime(Date.now());
        refreshSaveSlots();
        console.log(`Game saved to slot ${slot}`);
      } else {
        setErrorMessage('Failed to save game');
      }
      
      return success;
    } catch (error) {
      setErrorMessage(`Save error: ${error}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [ecsManager, playerEntityId, globalState, refreshSaveSlots]);
  
  // Load game from localStorage
  const loadGame = useCallback((slot: number = 1) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const result = SaveSystem.loadFromLocalStorage(ecsManager, slot);
      
      if (result && onGameLoaded) {
        onGameLoaded(result.playerEntityId, result.globalState);
        setLastSaveTime(Date.now());
        refreshSaveSlots();
        console.log(`Game loaded from slot ${slot}`);
        return true;
      } else {
        setErrorMessage('Failed to load game');
        return false;
      }
    } catch (error) {
      setErrorMessage(`Load error: ${error}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [ecsManager, onGameLoaded, refreshSaveSlots]);
  
  // Export game to file
  const exportGame = useCallback((filename?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const success = SaveSystem.exportToFile(ecsManager, playerEntityId, globalState, filename);
      
      if (!success) {
        setErrorMessage('Failed to export game');
      }
      
      return success;
    } catch (error) {
      setErrorMessage(`Export error: ${error}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [ecsManager, playerEntityId, globalState]);
  
  // Import game from file
  const importGame = useCallback(async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const result = await SaveSystem.importFromFile(ecsManager, file);
      
      if (result && onGameLoaded) {
        onGameLoaded(result.playerEntityId, result.globalState);
        setLastSaveTime(Date.now());
        console.log('Game imported from file');
        return true;
      } else {
        setErrorMessage('Failed to import game');
        return false;
      }
    } catch (error) {
      setErrorMessage(`Import error: ${error}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [ecsManager, onGameLoaded]);
  
  // Check if save slot exists
  const hasSaveSlot = useCallback((slot: number) => {
    return SaveSystem.hasSaveSlot(slot);
  }, []);
  
  // Delete save slot
  const deleteSaveSlot = useCallback((slot: number) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const success = SaveSystem.deleteSaveSlot(slot);
      
      if (success) {
        refreshSaveSlots();
        console.log(`Deleted save slot ${slot}`);
      } else {
        setErrorMessage('Failed to delete save slot');
      }
      
      return success;
    } catch (error) {
      setErrorMessage(`Delete error: ${error}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshSaveSlots]);
  
  // Initialize save slots on mount
  useEffect(() => {
    refreshSaveSlots();
  }, []);
  
  return {
    saveGame,
    exportGame,
    loadGame,
    importGame,
    saveSlots,
    hasSaveSlot,
    deleteSaveSlot,
    isLoading,
    lastSaveTime,
    errorMessage,
  };
}

// Save/Load UI Component
export function SaveLoadUI({ saveLoadHook }: { saveLoadHook: SaveLoadHookReturn }) {
  const {
    saveGame,
    exportGame,
    loadGame,
    importGame,
    saveSlots,
    hasSaveSlot,
    deleteSaveSlot,
    isLoading,
    lastSaveTime,
    errorMessage,
  } = saveLoadHook;
  
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importGame(file);
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  return (
    <div className="save-load-ui">
      <h3>Save & Load</h3>
      
      {/* Error Display */}
      {errorMessage && (
        <div className="error-message">
          <p>{errorMessage}</p>
        </div>
      )}
      
      {/* Quick Save/Load */}
      <div className="quick-actions">
        <button 
          onClick={() => saveGame(1)} 
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Quick Save (Slot 1)'}
        </button>
        <button 
          onClick={() => loadGame(1)} 
          disabled={isLoading || !hasSaveSlot(1)}
        >
          {isLoading ? 'Loading...' : 'Quick Load (Slot 1)'}
        </button>
      </div>
      
      {/* Last Save Time */}
      {lastSaveTime && (
        <div className="last-save">
          Last saved: {formatTimestamp(lastSaveTime)}
        </div>
      )}
      
      {/* Save Slots */}
      <div className="save-slots">
        <h4>Save Slots</h4>
        {saveSlots.map((slot) => (
          <div key={slot.slot} className="save-slot">
            <div className="slot-info">
              <strong>Slot {slot.slot}</strong>
              <span className="timestamp">
                {formatTimestamp(slot.timestamp)}
              </span>
            </div>
            <div className="slot-details">
              <span>Turn: {slot.turnCount}</span>
              <span>Entities: {slot.entityCount}</span>
              <span>Status: {slot.gameState}</span>
            </div>
            <div className="slot-actions">
              <button onClick={() => saveGame(slot.slot)} disabled={isLoading}>
                Save
              </button>
              <button onClick={() => loadGame(slot.slot)} disabled={isLoading}>
                Load
              </button>
              <button 
                onClick={() => deleteSaveSlot(slot.slot)} 
                disabled={isLoading}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        
        {/* Empty Slots */}
        {Array.from({ length: 10 }, (_, i) => i + 1).map(slot => 
          !saveSlots.find(s => s.slot === slot) && (
            <div key={slot} className="save-slot empty">
              <div className="slot-info">
                <strong>Slot {slot}</strong>
                <span className="timestamp">Empty</span>
              </div>
              <div className="slot-actions">
                <button onClick={() => saveGame(slot)} disabled={isLoading}>
                  Save
                </button>
              </div>
            </div>
          )
        )}
      </div>
      
      {/* Import/Export */}
      <div className="import-export">
        <h4>Import/Export</h4>
        <div className="export-section">
          <button onClick={() => exportGame()} disabled={isLoading}>
            Export to File
          </button>
        </div>
        <div className="import-section">
          <label>
            Import from File:
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportFile}
              disabled={isLoading}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// Auto-save hook
export function useAutoSave(
  saveLoadHook: SaveLoadHookReturn,
  intervalMs: number = 300000, // 5 minutes default
  autoSaveSlot: number = 10 // Use slot 10 for auto-saves
) {
  const { saveGame } = saveLoadHook;
  
  useState(() => {
    const autoSaveInterval = setInterval(() => {
      saveGame(autoSaveSlot);
      console.log('Auto-save completed');
    }, intervalMs);
    
    return () => clearInterval(autoSaveInterval);
  });
}
