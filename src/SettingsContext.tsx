import {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { useKeybindings, DEFAULT_KEYBINDINGS } from "./hooks/useKeybindings";
import {
  DEFAULT_TORCH_HEX,
  DEFAULT_TORCH_INTENSITY,
} from "../roguelike-mazetools/src/rendering/torchLighting";
import type { PlayerActor } from "../roguelike-mazetools/src/turn/turnTypes";
import { ComponentRegistry } from "../roguelike-mazetools/src/examples/ECS/Registry";
import type { Entity } from "../roguelike-mazetools/src/examples/ECS/Components";
import { createPlayerInstance } from "../roguelike-mazetools/src/examples/ECS/ObjectDefinition";

type EcsData = {
  registry: ComponentRegistry;
  playerEntity: Entity;
  playerInventory: Entity;
  leftHand: Entity;
  rightHand: Entity;
};

type PlayerData = PlayerActor & {
  ecsData: EcsData;
};

type Keybindings = typeof DEFAULT_KEYBINDINGS;

interface SettingsContextValue {
  playerData: PlayerData;
  setPlayerData: Dispatch<SetStateAction<PlayerData>>;
  dungeonSeed: number;
  setDungeonSeed: Dispatch<SetStateAction<number>>;
  dungeonWidth: number;
  setDungeonWidth: Dispatch<SetStateAction<number>>;
  dungeonHeight: number;
  setDungeonHeight: Dispatch<SetStateAction<number>>;
  minLeafSize: number;
  setMinLeafSize: Dispatch<SetStateAction<number>>;
  maxLeafSize: number;
  setMaxLeafSize: Dispatch<SetStateAction<number>>;
  minRoomSize: number;
  setMinRoomSize: Dispatch<SetStateAction<number>>;
  maxRoomSize: number;
  setMaxRoomSize: Dispatch<SetStateAction<number>>;
  maxDoors: number;
  setMaxDoors: Dispatch<SetStateAction<number>>;
  trapDensity: number;
  setTrapDensity: Dispatch<SetStateAction<number>>;
  tempDropPerStep: number;
  setTempDropPerStep: Dispatch<SetStateAction<number>>;
  heatingPerStep: number;
  setHeatingPerStep: Dispatch<SetStateAction<number>>;
  satiationDropPerStep: number;
  setSatiationDropPerStep: Dispatch<SetStateAction<number>>;
  supersatiationBonus: number;
  setSupersatiationBonus: Dispatch<SetStateAction<number>>;
  turnsPerRound: number;
  setTurnsPerRound: Dispatch<SetStateAction<number>>;
  traversalFactor: number;
  setTraversalFactor: Dispatch<SetStateAction<number>>;
  adventurerDreadRate: number;
  setAdventurerDreadRate: Dispatch<SetStateAction<number>>;
  adventurerLootPerChest: number;
  setAdventurerLootPerChest: Dispatch<SetStateAction<number>>;
  winRounds: number;
  setWinRounds: Dispatch<SetStateAction<number>>;
  danceSatiationBoost: number;
  setDanceSatiationBoost: Dispatch<SetStateAction<number>>;
  teaSatiationAmount: number;
  setTeaSatiationAmount: Dispatch<SetStateAction<number>>;
  teaHpRestorePercent: number;
  setTeaHpRestorePercent: Dispatch<SetStateAction<number>>;
  startIngredientAmount: number;
  setStartIngredientAmount: Dispatch<SetStateAction<number>>;
  torchColor: string;
  setTorchColor: Dispatch<SetStateAction<string>>;
  torchIntensity: number;
  setTorchIntensity: Dispatch<SetStateAction<number>>;
  keybindings: Keybindings;
  setKeybindings: (next: Keybindings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [playerData, setPlayerData] = useState({
    id: "player",
    kind: "player" as const,
    speed: 100,
    alive: true,
    blocksMovement: true,
    x: 0,
    y: 0,
    hp: 10,
    maxHp: 10,
    attack: 3,
    defense: 1,
    ecsData: (() => {
      const registry = new ComponentRegistry();
      registry.initializeRegistry();
      const playerEntity = createPlayerInstance(registry);
      const playerInventory = registry.getInventoriesByOwner(playerEntity)[0];
      const leftHandEntity = registry.createEntity();
      registry.createInventory(leftHandEntity, 1);
      const leftHand = registry.getInventoriesByOwner(leftHandEntity)[0];
      const rightHandEntity = registry.createEntity();
      registry.createInventory(rightHandEntity, 1);
      const rightHand = registry.getInventoriesByOwner(rightHandEntity)[0];
      return { registry, playerEntity, playerInventory, leftHand, rightHand };
    })(),
  });

  const [dungeonSeed, setDungeonSeed] = useState(42);
  const [dungeonWidth, setDungeonWidth] = useState(32);
  const [dungeonHeight, setDungeonHeight] = useState(32);
  const [minLeafSize, setMinLeafSize] = useState(6);
  const [maxLeafSize, setMaxLeafSize] = useState(14);
  const [minRoomSize, setMinRoomSize] = useState(3);
  const [maxRoomSize, setMaxRoomSize] = useState(7);
  const [maxDoors, setMaxDoors] = useState(3);
  const [trapDensity, setTrapDensity] = useState(1.0);
  const [tempDropPerStep, setTempDropPerStep] = useState(0.5);
  const [heatingPerStep, setHeatingPerStep] = useState(2.0);
  const [satiationDropPerStep, setSatiationDropPerStep] = useState(0.5);
  const [supersatiationBonus, setSupersatiationBonus] = useState(50);
  const [turnsPerRound, setTurnsPerRound] = useState(120);
  const [traversalFactor, setTraversalFactor] = useState(2.0);
  const [adventurerDreadRate, setAdventurerDreadRate] = useState(1.0);
  const [adventurerLootPerChest, setAdventurerLootPerChest] = useState(10);
  const [winRounds, setWinRounds] = useState(10);
  const [danceSatiationBoost, setDanceSatiationBoost] = useState(5);
  const [teaSatiationAmount, setTeaSatiationAmount] = useState(100);
  const [teaHpRestorePercent, setTeaHpRestorePercent] = useState(25);
  const [startIngredientAmount, setStartIngredientAmount] = useState(3);
  const [torchColor, setTorchColor] = useState<string>(() => {
    try {
      return localStorage.getItem("torchColor") ?? DEFAULT_TORCH_HEX;
    } catch {
      return DEFAULT_TORCH_HEX;
    }
  });
  const [torchIntensity, setTorchIntensity] = useState<number>(() => {
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
        playerData,
        setPlayerData,
        dungeonSeed,
        setDungeonSeed,
        dungeonWidth,
        setDungeonWidth,
        dungeonHeight,
        setDungeonHeight,
        minLeafSize,
        setMinLeafSize,
        maxLeafSize,
        setMaxLeafSize,
        minRoomSize,
        setMinRoomSize,
        maxRoomSize,
        setMaxRoomSize,
        maxDoors,
        setMaxDoors,
        trapDensity,
        setTrapDensity,
        tempDropPerStep,
        setTempDropPerStep,
        heatingPerStep,
        setHeatingPerStep,
        satiationDropPerStep,
        setSatiationDropPerStep,
        supersatiationBonus,
        setSupersatiationBonus,
        turnsPerRound,
        setTurnsPerRound,
        traversalFactor,
        setTraversalFactor,
        adventurerDreadRate,
        setAdventurerDreadRate,
        adventurerLootPerChest,
        setAdventurerLootPerChest,
        winRounds,
        setWinRounds,
        danceSatiationBoost,
        setDanceSatiationBoost,
        teaSatiationAmount,
        setTeaSatiationAmount,
        teaHpRestorePercent,
        setTeaHpRestorePercent,
        startIngredientAmount,
        setStartIngredientAmount,
        torchColor,
        setTorchColor,
        torchIntensity,
        setTorchIntensity,
        keybindings,
        setKeybindings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx)
    throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
