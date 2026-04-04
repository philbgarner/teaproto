import { useSettings } from "./SettingsContext";
import { useDungeonSetup } from "./hooks/useDungeonSetup";
import { useGameState } from "./hooks/useGameState";
import { useEotBCamera } from "./hooks/useEotBCamera";
import { GameView } from "./components/GameView";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { DifficultyModal } from "./components/DifficultyModal";
import { PLAYER_MAX_HP } from "./gameConstants";
import "./App.css";

export default function App() {
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
      onTurn: gs.onTurn,
      blocked:
        gs.showRecipeMenu || gs.showSummonMenu || gs.gameState !== "playing",
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
          onPlayAgain={() => {
            setDungeonSeed((s: number) => s);
            const freshSatiations = ds.initialMobs.map(() => 40);
            gs.clearHands();
            gs.setMobSatiations(freshSatiations);
            gs.setRoomTempRise(new Map());
            gs.setStoveStates(new Map());
            gs.setShowRecipeMenu(false);
            gs.setActiveStoveKey(null);
            gs.setMessage(null);
            gs.setAdventurers([]);
            gs.setCurrentRound(0);
            gs.setTurnCount(0);
            gs.setRoundCountdown(turnsPerRound);
            gs.setPlayerXp(0);
            gs.setXpDrops([]);
            gs.setPlayerHp(PLAYER_MAX_HP);
            gs.setIngredients({
              "hot-pepper": 0,
              "wild-herb": 0,
              "frost-leaf": 0,
            });
            gs.setIngredientDrops([...ds.initialIngredientDrops]);
            gs.setChests([...ds.initialChests]);
            gs.chestsRef.current = [...ds.initialChests];
            gs.setGameState("playing");
            gs.setGameOverReason(null);
            gs.adventurersRef.current = [];
            gs.currentRoundRef.current = 0;
            gs.turnCountRef.current = 0;
            gs.roundCountdownRef.current = turnsPerRound;
            gs.playerXpRef.current = 0;
            gs.xpDropsRef.current = [];
            gs.playerHpRef.current = PLAYER_MAX_HP;
            gs.ingredientsRef.current = {
              "hot-pepper": 0,
              "wild-herb": 0,
              "frost-leaf": 0,
            };
            gs.ingredientDropsRef.current = [...ds.initialIngredientDrops];
            gs.mobSatiationsRef.current = freshSatiations;
            const freshPositions = ds.initialMobs.map((m: any) => ({
              x: m.x,
              z: m.z,
            }));
            gs.setMobPositions(freshPositions);
            gs.mobPositionsRef.current = freshPositions;
            gs.ruinedNotifiedRef.current = new Set();
          }}
        />
      }
    />
  );
}
