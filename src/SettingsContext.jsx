import { createContext, useContext, useState } from "react";
import { useKeybindings } from "./hooks/useKeybindings";
import {
  DEFAULT_TORCH_HEX,
  DEFAULT_TORCH_INTENSITY,
} from "../mazetools/src/rendering/torchLighting";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [dungeonSeed, setDungeonSeed] = useState(42);
  const [dungeonWidth, setDungeonWidth] = useState(32);
  const [dungeonHeight, setDungeonHeight] = useState(32);
  const [minLeafSize, setMinLeafSize] = useState(6);
  const [maxLeafSize, setMaxLeafSize] = useState(14);
  const [minRoomSize, setMinRoomSize] = useState(3);
  const [maxRoomSize, setMaxRoomSize] = useState(7);
  const [maxDoors, setMaxDoors] = useState(3);
  const [tempDropPerStep, setTempDropPerStep] = useState(0.5);
  const [heatingPerStep, setHeatingPerStep] = useState(2.0);
  const [satiationDropPerStep, setSatiationDropPerStep] = useState(0.5);
  const [supersatiationBonus, setSupersatiationBonus] = useState(50);
  const [turnsPerWave, setTurnsPerWave] = useState(120);
  const [traversalFactor, setTraversalFactor] = useState(2.0);
  const [adventurerDreadRate, setAdventurerDreadRate] = useState(1.0);
  const [adventurerLootPerChest, setAdventurerLootPerChest] = useState(10);
  const [torchColor, setTorchColor] = useState(() => {
    try {
      return localStorage.getItem("torchColor") ?? DEFAULT_TORCH_HEX;
    } catch {
      return DEFAULT_TORCH_HEX;
    }
  });
  const [torchIntensity, setTorchIntensity] = useState(() => {
    try {
      const stored = localStorage.getItem("torchIntensity");
      return stored !== null ? parseFloat(stored) : DEFAULT_TORCH_INTENSITY;
    } catch {
      return DEFAULT_TORCH_INTENSITY;
    }
  });
  const [keybindings, setKeybindings] = useKeybindings();

  return (
    <SettingsContext.Provider
      value={{
        dungeonSeed, setDungeonSeed,
        dungeonWidth, setDungeonWidth,
        dungeonHeight, setDungeonHeight,
        minLeafSize, setMinLeafSize,
        maxLeafSize, setMaxLeafSize,
        minRoomSize, setMinRoomSize,
        maxRoomSize, setMaxRoomSize,
        maxDoors, setMaxDoors,
        tempDropPerStep, setTempDropPerStep,
        heatingPerStep, setHeatingPerStep,
        satiationDropPerStep, setSatiationDropPerStep,
        supersatiationBonus, setSupersatiationBonus,
        turnsPerWave, setTurnsPerWave,
        traversalFactor, setTraversalFactor,
        adventurerDreadRate, setAdventurerDreadRate,
        adventurerLootPerChest, setAdventurerLootPerChest,
        torchColor, setTorchColor,
        torchIntensity, setTorchIntensity,
        keybindings, setKeybindings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
