import { useState } from "react";
import { useSettings } from "./SettingsContext";
import { useDungeonSetup } from "./hooks/useDungeonSetup";
import { useGameState } from "./hooks/useGameState";
import { useEotBCamera } from "./hooks/useEotBCamera";
import { GameView } from "./components/GameView";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { DifficultyModal } from "./components/DifficultyModal";
import "./App.css";

export default function App({ onReturnToTitle }: { onReturnToTitle?: () => void } = {}) {
  const {
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
    trapDensity,
    setTrapDensity,
    keybindings,
    setKeybindings,
    showActionLog,
    setShowActionLog,
    musicVolume,
    setMusicVolume,
    sfxVolume,
    setSfxVolume,
  } = useSettings();

  const [forceReset, setForceReset] = useState(0);

  const ds = useDungeonSetup({
    dungeonSeed,
    dungeonWidth,
    dungeonHeight,
    minLeafSize,
    maxLeafSize,
    minRoomSize,
    maxRoomSize,
    maxDoors,
    trapDensity,
    forceReset,
  });

  const gs = useGameState({
    dungeon: ds.dungeon,
    solidData: ds.solidData,
    floorData: ds.floorData,
    wallData: ds.wallData,
    ceilingData: ds.ceilingData,
    temperatureData: ds.temperatureData,
    initialMobs: ds.initialMobs,
    adventurerSpawnRooms: ds.adventurerSpawnRooms,
    initialIngredientDrops: ds.initialIngredientDrops,
    initialChests: ds.initialChests,
    spawnX: ds.spawnX,
    spawnZ: ds.spawnZ,
    spawnYaw: ds.spawnYaw,
    stovePlacements: ds.stovePlacements,
    doorPlacements: ds.doorPlacements,
    hazardData: ds.hazardData,
    dungeonSeed,
    dungeonWidth,
    dungeonHeight,
    tempDropPerStep,
    heatingPerStep,
    satiationDropPerStep,
    supersatiationBonus,
    turnsPerRound,
    traversalFactor,
    adventurerDreadRate,
    adventurerLootPerChest,
    winRounds,
    danceSatiationBoost,
    teaSatiationAmount,
    teaHpRestorePercent,
    startIngredientAmount,
    keybindings,
  });

  const {
    camera,
    logicalRef: camLogicalRef,
    doMove,
  } = useEotBCamera(
    ds.solidData,
    dungeonWidth,
    dungeonHeight,
    ds.spawnX,
    ds.spawnZ,
    {
      onStep: gs.onStep,
      onRotation: () => {
        // Update facing target immediately when player rotates
        const facingTarget = gs.getFacingTarget(camLogicalRef);
        gs.facingTargetRef.current = facingTarget;
      },
      blocked: gs.showRecipeMenu || gs.gameState !== "playing",
      onBlockedMove: gs.onBlockedMove,
      canPhaseWalls: !gs.leftHandTea && !gs.rightHandTea,
      blockedPositions: [
        ...ds.stovePlacements,
        ...ds.doorPlacements.filter(
          (d: any) => gs.doorStates.get(`${d.x}_${d.z}`) === "locked",
        ),
      ],
      keybindings,
      startYaw: ds.spawnYaw,
      resetKey: forceReset,
    },
  );

  gs.logicalRef.current = camLogicalRef.current;
  gs.doMoveRef.current = doMove;
  const facingTarget = gs.getFacingTarget(camLogicalRef);
  gs.facingTargetRef.current = facingTarget;

  return (
    <GameView
      gs={gs}
      ds={ds}
      camera={camera}
      facingTarget={facingTarget}
      dungeonWidth={dungeonWidth}
      dungeonHeight={dungeonHeight}
      torchColor={torchColor}
      torchIntensity={torchIntensity}
      keybindings={keybindings}
      onOpenSettings={() => gs.setShowSettings(true)}
      openMenuKeys={keybindings.openMenu}
      summonMonsterKeys={keybindings.summon}
      discardLeftKeys={keybindings.discardLeft}
      discardRightKeys={keybindings.discardRight}
      settingsModal={
        <DifficultyModal
          visible={gs.showSettings}
          onClose={() => gs.setShowSettings(false)}
          settingsProps={{
            onResetToDefaults: () => {
              try {
                localStorage.clear();
              } catch {
                /* */
              }
              setTempDropPerStep(0.5);
              setHeatingPerStep(2.0);
              setSatiationDropPerStep(0.5);
              setSupersatiationBonus(50);
              setTurnsPerRound(120);
              setTraversalFactor(2.0);
              setAdventurerDreadRate(1.0);
              setAdventurerLootPerChest(10);
              setWinRounds(10);
              setDanceSatiationBoost(5);
              setTeaSatiationAmount(100);
              setTeaHpRestorePercent(25);
              setStartIngredientAmount(3);
              setTrapDensity(1.0);
              setMaxDoors(3);
            },
            danceSatiationBoost,
            setDanceSatiationBoost,
            teaSatiationAmount,
            setTeaSatiationAmount,
            teaHpRestorePercent,
            setTeaHpRestorePercent,
            startIngredientAmount,
            setStartIngredientAmount,
            tempDropPerStep,
            setTempDropPerStep,
            heatingPerStep,
            setHeatingPerStep,
            satiationDropPerStep,
            turnsPerRound,
            setTurnsPerRound,
            setSatiationDropPerStep,
            supersatiationBonus,
            setSupersatiationBonus,
            traversalFactor,
            setTraversalFactor,
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
            adventurerDreadRate,
            setAdventurerDreadRate,
            adventurerLootPerChest,
            setAdventurerLootPerChest,
            winRounds,
            setWinRounds,
            maxDoors,
            setMaxDoors,
            trapDensity,
            setTrapDensity,
            torchColor,
            setTorchColor,
            torchIntensity,
            setTorchIntensity,
            keybindings,
            setKeybindings,
            showActionLog,
            setShowActionLog,
            musicVolume,
            setMusicVolume,
            sfxVolume,
            setSfxVolume,
          }}
        />
      }
      gameOverlay={
        <GameOverOverlay
          gameState={gs.gameState}
          gameOverReason={gs.gameOverReason}
          currentRound={gs.currentRound}
          turnCount={gs.turnCount}
          winRounds={winRounds}
          seed={dungeonSeed}
          onPlaySameSeed={() => setForceReset(prev => prev + 1)}
          onPlayNewSeed={() => {
            setDungeonSeed(Math.floor(Math.random() * 999999));
            setForceReset(prev => prev + 1);
          }}
          onReturnToTitle={onReturnToTitle}
        />
      }
    />
  );
}
