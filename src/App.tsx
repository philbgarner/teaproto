import { useMemo } from "react";
import { useSettings } from "./SettingsContext";
import { useDungeonSetup } from "./hooks/useDungeonSetup";
import { useGameState } from "./hooks/useGameState";
import { useEotBCamera } from "./hooks/useEotBCamera";
import { PerspectiveDungeonView } from "../roguelike-mazetools/src/rendering/PerspectiveDungeonView";
import { GameHeader } from "./components/GameHeader";
import { StatusBar } from "./components/StatusBar";
import { WaveCountdown } from "./components/WaveCountdown";
import { RecipeMenu } from "./components/RecipeMenu";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { MinimapSidebar } from "./components/MinimapSidebar";
import { DifficultyModal } from "./components/DifficultyModal";
import { RECIPES } from "./tea";
import {
  TILE_FLOOR,
  TILE_CEILING,
  TILE_WALL,
  CEILING_H,
  TILE_SIZE,
  FLOOR_TILE_MAP,
  WALL_TILE_MAP,
  CEILING_TILE_MAP,
  PASSAGE_OVERLAY_IDS,
  PLAYER_MAX_HP,
  WAVE_COUNTDOWN_THRESHOLD,
  WIN_WAVES,
} from "./gameConstants";
import { cardinalDir } from "./gameUtils";
import "./App.css";

export default function App() {
  const {
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
    tempDropPerStep,
    setTempDropPerStep,
    heatingPerStep,
    setHeatingPerStep,
    satiationDropPerStep,
    setSatiationDropPerStep,
    supersatiationBonus,
    setSupersatiationBonus,
    turnsPerWave,
    setTurnsPerWave,
    traversalFactor,
    setTraversalFactor,
    adventurerDreadRate,
    setAdventurerDreadRate,
    adventurerLootPerChest,
    setAdventurerLootPerChest,
    torchColor,
    setTorchColor,
    torchIntensity,
    setTorchIntensity,
    keybindings,
    setKeybindings,
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
    dungeonSeed,
    dungeonWidth,
    dungeonHeight,
    tempDropPerStep,
    heatingPerStep,
    satiationDropPerStep,
    supersatiationBonus,
    turnsPerWave,
    traversalFactor,
    adventurerDreadRate,
    adventurerLootPerChest,
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
      blocked: gs.showRecipeMenu || gs.gameState !== "playing",
      onBlockedMove: gs.onBlockedMove,
      canPhaseWalls: !gs.playerHands.left && !gs.playerHands.right,
      keybindings,
      startYaw: ds.spawnYaw,
    },
  );

  // Sync game state's logical ref with camera's logical ref so onStep can
  // read the current player position.
  gs.logicalRef.current = camLogicalRef.current;

  // Wire doMove for passage traversal.
  gs.doMoveRef.current = doMove;

  // Compute facing target and expose it to game state handlers via ref.
  const facingTarget = gs.getFacingTarget(camLogicalRef);
  gs.facingTargetRef.current = facingTarget;

  // Interaction prompt text
  const promptText = useMemo(() => {
    if (!facingTarget) return null;
    if (facingTarget.type === "stove") {
      const state = gs.stoveStates.get(facingTarget.stoveKey);
      if (!state?.brewing) return "Stove — Press [space] to brew tea";
      if (state.brewing.ready)
        return `${state.brewing.recipe.name} is ready! — Press [space] to collect`;
      return `Brewing ${state.brewing.recipe.name}: ${state.brewing.stepsRemaining} steps — Press [space] for status`;
    }
    const mob = ds.initialMobs[facingTarget.mobIdx];
    const preferredRecipe = RECIPES.find(
      (r) => r.id === mob?.preferredRecipeId,
    );
    const isUnconscious = gs.mobSatiations[facingTarget.mobIdx] <= 0;
    if (isUnconscious) {
      return `${mob?.name} is unconscious — Press [space] to offer tea to revive`;
    }
    return `${mob?.name} [prefers ${preferredRecipe?.name ?? "?"}] — Press [space] to offer tea`;
  }, [facingTarget, gs.stoveStates, ds.initialMobs, gs.mobSatiations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cells currently occupied by player or creatures — used to open doors.
  const doorOccupiedKeys = useMemo(() => {
    const keys = new Set<string>();
    keys.add(`${Math.floor(camera.x)}_${Math.floor(camera.z)}`);
    for (const pos of gs.mobPositions) keys.add(`${pos.x}_${pos.z}`);
    for (const adv of gs.adventurers) {
      if (adv.alive) keys.add(`${adv.x}_${adv.z}`);
    }
    return keys;
  }, [camera.x, camera.z, gs.mobPositions, gs.adventurers]);

  console.log("playerData", playerData);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100vw",
          height: "100vh",
          background: "#000",
          color: "#ccc",
          fontFamily: "'Metamorphous', serif",
        }}
      >
        {/* Main area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 3D view */}
          <div
            style={{
              flex: 1,
              position: "relative",
              outline: "1px solid #1a1816",
            }}
          >
            {/* Inset bevel overlay — sits above the WebGL canvas */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 10,
                boxShadow:
                  "inset 0 6px 0 0 #1a1816, inset 6px 0 0 0 #1e1c1a, inset 0 -6px 0 0 #7a7268, inset -6px 0 0 0 #6a6258, inset 0 18px 40px rgba(0,0,0,0.7), inset 0 -6px 12px rgba(255,255,255,0.03)",
              }}
            />
            {gs.texture && ds.solidData && (
              <PerspectiveDungeonView
                solidData={ds.solidData}
                width={dungeonWidth}
                height={dungeonHeight}
                cameraX={camera.x}
                cameraZ={camera.z}
                yaw={camera.yaw}
                atlas={gs.atlas}
                texture={gs.texture}
                floorTile={TILE_FLOOR}
                ceilingTile={TILE_CEILING}
                ceilingHeight={CEILING_H}
                wallTile={TILE_WALL}
                renderRadius={28}
                fov={60}
                fogNear={4}
                fogFar={28}
                tileSize={TILE_SIZE}
                objects={ds.objects}
                objectRegistry={gs.objectRegistry}
                objectOccupiedKeys={doorOccupiedKeys}
                mobiles={gs.mobiles}
                spriteAtlas={gs.characterSpriteAtlas}
                adventurerSpriteAtlas={gs.characterSpriteAtlas}
                passageMask={gs.passageMask ?? undefined}
                passageOverlayIds={PASSAGE_OVERLAY_IDS}
                speechBubbles={gs.activeSpeechBubbles}
                torchColor={torchColor}
                torchIntensity={torchIntensity}
                floorData={ds.floorData}
                wallData={ds.wallData}
                ceilingData={ds.ceilingData}
                floorTileMap={FLOOR_TILE_MAP}
                wallTileMap={WALL_TILE_MAP}
                ceilingTileMap={CEILING_TILE_MAP}
                style={{ width: "100%", height: "100%" }}
              />
            )}

            <WaveCountdown
              turnsLeft={gs.waveCountdown}
              visible={
                gs.waveCountdown <= WAVE_COUNTDOWN_THRESHOLD &&
                gs.adventurers.filter((a: any) => a.alive).length === 0
              }
            />

            {/* Interaction prompt */}
            {promptText && !gs.showRecipeMenu && (
              <div
                style={{
                  position: "absolute",
                  bottom: 70,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#2e2c29",
                  outline: "1px solid #1e1c1a",
                  boxShadow:
                    "inset 0 2px 0 0 #5a5450, inset 2px 0 0 0 #504a46, inset 0 -2px 0 0 #1a1816, inset -2px 0 0 0 #1e1c1a, inset 0 4px 12px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.8)",
                  backgroundImage:
                    "repeating-conic-gradient(rgba(0,0,0,0.03) 0% 25%, transparent 0% 50%)",
                  backgroundSize: "4px 4px",
                  padding: "6px 14px",
                  fontSize: 13,
                  color: "#c8a060",
                  fontFamily: '"Metamorphous", serif',
                  letterSpacing: "0.05em",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {promptText}
              </div>
            )}

            {gs.showRecipeMenu && (
              <RecipeMenu
                recipes={RECIPES}
                ingredients={gs.ingredients}
                showMsg={gs.showMsg}
                selectedIndex={gs.recipeMenuCursor}
                keybindings={keybindings}
                onSelectRecipe={(recipe: any) => {
                  if (recipe.ingredientId) {
                    const newIng = {
                      ...gs.ingredientsRef.current,
                      [recipe.ingredientId]:
                        gs.ingredientsRef.current[recipe.ingredientId] - 1,
                    };
                    gs.ingredientsRef.current = newIng;
                    gs.setIngredients(newIng);
                  }
                  gs.setStoveStates((prev: Map<string, any>) => {
                    const next = new Map(prev);
                    next.set(gs.activeStoveKey, {
                      brewing: {
                        recipe,
                        stepsRemaining: recipe.timeToBrew,
                        ready: false,
                      },
                    });
                    return next;
                  });
                  gs.setShowRecipeMenu(false);
                  gs.showMsg(
                    `Started brewing ${recipe.name}! ${recipe.timeToBrew} steps until ready.`,
                  );
                }}
                onCancel={() => gs.setShowRecipeMenu(false)}
              />
            )}

            {/* Message */}
            {gs.message && (
              <div
                style={{
                  position: "absolute",
                  top: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#2a2720",
                  outline: "1px solid #1a1814",
                  boxShadow:
                    "inset 0 2px 0 0 #6a6058, inset 2px 0 0 0 #5a5248, inset 0 -2px 0 0 #141210, inset -2px 0 0 0 #1a1814, inset 0 4px 16px rgba(0,0,0,0.6), 0 6px 24px rgba(0,0,0,0.9)",
                  backgroundImage:
                    "repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%)",
                  backgroundSize: "4px 4px",
                  padding: "12px 28px",
                  fontSize: 17,
                  fontFamily: '"Metamorphous", serif',
                  letterSpacing: "0.06em",
                  maxWidth: 560,
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                {/* Invisible full text holds the final size */}
                <span style={{ visibility: "hidden", userSelect: "none" }}>{gs.message}</span>
                {/* Typed text overlaid on top */}
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#e0b870", padding: "12px 28px" }}>{gs.displayedText}</span>
              </div>
            )}
          </div>

          <MinimapSidebar
            solidData={ds.solidData}
            dungeonWidth={dungeonWidth}
            dungeonHeight={dungeonHeight}
            camera={camera}
            exploredMaskRef={gs.exploredMaskRef}
            texture={gs.texture}
            atlas={gs.atlas}
            floorTile={TILE_FLOOR}
            floorData={ds.floorData}
            floorTileMap={FLOOR_TILE_MAP}
            tileSize={TILE_SIZE}
          />
        </div>

        <DifficultyModal
          visible={gs.showSettings}
          onClose={() => gs.setShowSettings(false)}
          settingsProps={{
            tempDropPerStep,
            setTempDropPerStep,
            heatingPerStep,
            setHeatingPerStep,
            satiationDropPerStep,
            turnsPerWave,
            setTurnsPerWave,
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
            maxDoors,
            setMaxDoors,
            torchColor,
            setTorchColor,
            torchIntensity,
            setTorchIntensity,
            keybindings,
            setKeybindings,
          }}
        />

        <StatusBar
          camera={camera}
          facing={cardinalDir(camera.yaw)}
          playerHp={gs.playerHp}
          playerMaxHp={PLAYER_MAX_HP}
          playerXp={gs.playerXp}
          ingredients={gs.ingredients}
          currentRoomTemp={(() => {
            const gx = Math.floor(camera.x);
            const gz = Math.floor(camera.z);
            const regionId = gs.regionIdData[gz * dungeonWidth + gx];
            return Math.min(
              255,
              127 + Math.round(gs.roomTempRise.get(regionId) ?? 0),
            );
          })()}
        />
      </div>

      <GameOverOverlay
        gameState={gs.gameState}
        gameOverReason={gs.gameOverReason}
        currentWave={gs.currentWave}
        turnCount={gs.turnCount}
        winWaves={WIN_WAVES}
        onPlayAgain={() => {
          setDungeonSeed((s) => s);
          const freshSatiations = ds.initialMobs.map(() => 40);
          gs.setPlayerHands({ left: null, right: null });
          gs.setMobSatiations(freshSatiations);
          gs.setRoomTempRise(new Map());
          gs.setStoveStates(new Map());
          gs.setShowRecipeMenu(false);
          gs.setActiveStoveKey(null);
          gs.setMessage(null);
          gs.setAdventurers([]);
          gs.setCurrentWave(0);
          gs.setTurnCount(0);
          gs.setWaveCountdown(turnsPerWave);
          gs.setPlayerXp(0);
          gs.setXpDrops([]);
          gs.setPlayerHp(PLAYER_MAX_HP);
          gs.setIngredients({ rations: 0, herbs: 0, dust: 0 });
          gs.setIngredientDrops([...ds.initialIngredientDrops]);
          gs.setChests([...ds.initialChests]);
          gs.chestsRef.current = [...ds.initialChests];
          gs.setGameState("playing");
          gs.setGameOverReason(null);
          gs.adventurersRef.current = [];
          gs.currentWaveRef.current = 0;
          gs.turnCountRef.current = 0;
          gs.waveCountdownRef.current = turnsPerWave;
          gs.playerXpRef.current = 0;
          gs.xpDropsRef.current = [];
          gs.playerHpRef.current = PLAYER_MAX_HP;
          gs.ingredientsRef.current = { rations: 0, herbs: 0, dust: 0 };
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
    </>
  );
}
