import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "./SettingsContext";
import { useDungeonTutorialSetup } from "./hooks/useDungeonTutorialSetup";
import { useGameState } from "./hooks/useGameState";
import { useEotBCamera } from "./hooks/useEotBCamera";
import { PerspectiveDungeonView } from "../roguelike-mazetools/src/rendering/PerspectiveDungeonView";
import { StatusBar } from "./components/StatusBar";
import { RecipeMenu } from "./components/RecipeMenu";
import { MinimapSidebar } from "./components/MinimapSidebar";
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
} from "./gameConstants";
import { cardinalDir } from "./gameUtils";
import { RECIPES } from "./tea";
import { LESSON_CONFIGS } from "./tutorial/lessons";
import { buildPassageMask } from "../roguelike-mazetools/src/rendering/hiddenPassagesMask";
import "./App.css";

// Tutorial uses Easy-like settings, rounds effectively disabled
const TUTORIAL_GAME_SETTINGS = {
  tempDropPerStep: 0.5,
  heatingPerStep: 6.0,
  satiationDropPerStep: 0.0,
  supersatiationBonus: 50,
  turnsPerRound: 999999,
  traversalFactor: 2.0,
  adventurerDreadRate: 0,
  adventurerLootPerChest: 0,
};

// ── Inner view ── keyed by lessonIndex so useEotBCamera resets each lesson ──

interface LessonViewProps {
  lessonIndex: number;
  ds: ReturnType<typeof useDungeonTutorialSetup>;
  gs: any;
  torchColor: string;
  torchIntensity: number;
  keybindings: any;
  onCameraStep: (x: number, z: number) => void;
}

function LessonView({
  lessonIndex,
  ds,
  gs,
  torchColor,
  torchIntensity,
  keybindings,
  onCameraStep,
}: LessonViewProps) {
  const config = LESSON_CONFIGS[lessonIndex];

  const {
    camera,
    logicalRef: camLogicalRef,
    doMove,
  } = useEotBCamera(
    ds.solidData,
    config.dungeonW,
    config.dungeonH,
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
      keybindings,
      startYaw: ds.spawnYaw,
    },
  );

  // Wire game-state refs to this camera instance
  gs.logicalRef.current = camLogicalRef.current;
  gs.doMoveRef.current = doMove;

  const facingTarget = gs.getFacingTarget(camLogicalRef);
  gs.facingTargetRef.current = facingTarget;

  // Report camera steps for lesson-completion checks in Tutorial
  useEffect(() => {
    onCameraStep(camera.x, camera.z);
  }, [camera.x, camera.z]); // eslint-disable-line react-hooks/exhaustive-deps

  const promptText = useMemo(() => {
    if (!facingTarget) return null;
    if (facingTarget.type === "stove") {
      const state = gs.stoveStates.get(facingTarget.stoveKey);
      if (!state?.brewing) return "Teaomatic — Press [space] to brew tea";
      if (state.brewing.ready)
        return `${state.brewing.recipe.name} is ready! — Press [space] to collect`;
      return `Brewing ${state.brewing.recipe.name}: ${state.brewing.stepsRemaining} steps — Press [space] for status`;
    }
    const mob = ds.initialMobs[facingTarget.mobIdx];
    const isUnconscious = gs.mobSatiations[facingTarget.mobIdx] <= 0;
    if (isUnconscious)
      return `${mob?.name} is unconscious — Press [space] to offer tea to revive`;
    const preferredRecipe = RECIPES.find((r) => r.id === mob?.preferredRecipeId);
    return `${mob?.name} [prefers ${preferredRecipe?.name ?? "?"}] — Press [space] to offer tea`;
  }, [facingTarget, gs.stoveStates, ds.initialMobs, gs.mobSatiations]); // eslint-disable-line react-hooks/exhaustive-deps

  const doorOccupiedKeys = useMemo(() => {
    const keys = new Set<string>();
    keys.add(`${Math.floor(camera.x)}_${Math.floor(camera.z)}`);
    for (const pos of gs.mobPositions) keys.add(`${pos.x}_${pos.z}`);
    return keys;
  }, [camera.x, camera.z, gs.mobPositions]);

  const msgBox = (
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
        textAlign: "center" as const,
        pointerEvents: "none" as const,
      }}
    >
      {/* Invisible full text holds the final size */}
      <span style={{ visibility: "hidden", userSelect: "none" }}>{gs.message}</span>
      {/* Typed text overlaid on top */}
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#e0b870", padding: "12px 28px" }}>{gs.displayedText}</span>
    </div>
  );

  const promptBox = (
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
        pointerEvents: "none" as const,
        whiteSpace: "nowrap" as const,
      }}
    >
      {promptText}
    </div>
  );

  return (
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
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, position: "relative", outline: "1px solid #1a1816" }}>
          {/* Inset bevel */}
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
              width={config.dungeonW}
              height={config.dungeonH}
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
              speechBubbles={gs.message ? gs.activeSpeechBubbles.map((b) => ({ ...b, inverted: true })) : gs.activeSpeechBubbles}
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

          {promptText && !gs.showRecipeMenu && promptBox}

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
                    brewing: { recipe, stepsRemaining: recipe.timeToBrew, ready: false },
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

          {gs.message && msgBox}

          {/* Tutorial lesson badge */}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              fontSize: 11,
              color: "#6a6258",
              fontFamily: '"Metamorphous", serif',
              letterSpacing: "0.08em",
              pointerEvents: "none",
            }}
          >
            Tutorial — Lesson {lessonIndex + 1} / {LESSON_CONFIGS.length}
          </div>
        </div>

        <MinimapSidebar
          solidData={ds.solidData}
          dungeonWidth={config.dungeonW}
          dungeonHeight={config.dungeonH}
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
          const regionId = gs.regionIdData[gz * config.dungeonW + gx];
          return Math.min(255, 127 + Math.round(gs.roomTempRise.get(regionId) ?? 0));
        })()}
      />
    </div>
  );
}

// ── Tutorial ─────────────────────────────────────────────────────────────────

export default function Tutorial({ onComplete }: { onComplete: () => void }) {
  const {
    torchColor,
    torchIntensity,
    keybindings,
    setTempDropPerStep,
    setHeatingPerStep,
    setSatiationDropPerStep,
    setSupersatiationBonus,
    setTurnsPerRound,
    setTraversalFactor,
    setAdventurerDreadRate,
    setAdventurerLootPerChest,
  } = useSettings();
  const [lessonIndex, setLessonIndex] = useState(0);
  const lessonDoneRef = useRef(false);

  const config = LESSON_CONFIGS[lessonIndex];
  const ds = useDungeonTutorialSetup(lessonIndex);

  const gs = useGameState({
    dungeon: ds.dungeon,
    solidData: ds.solidData,
    floorData: ds.floorData,
    wallData: ds.wallData,
    ceilingData: ds.ceilingData,
    temperatureData: ds.temperatureData,
    initialMobs: ds.initialMobs,
    adventurerSpawnRooms: [],
    initialIngredientDrops: [],
    initialChests: [],
    spawnX: ds.spawnX,
    spawnZ: ds.spawnZ,
    spawnYaw: ds.spawnYaw,
    stovePlacements: ds.stovePlacements,
    doorPlacements: [],
    hazardData: new Uint8Array(config.dungeonW * config.dungeonH),
    dungeonSeed: 0x1337 + lessonIndex,
    dungeonWidth: config.dungeonW,
    dungeonHeight: config.dungeonH,
    ...TUTORIAL_GAME_SETTINGS,
    keybindings,
  });

  // ── Per-lesson init ───────────────────────────────────────────────────────

  useEffect(() => {
    lessonDoneRef.current = false;

    // Start every lesson fully unexplored
    if (gs.exploredMaskRef.current) {
      gs.exploredMaskRef.current.fill(0);
    }

    // Lesson 1: replace auto-generated passages with our specific one
    if (lessonIndex === 0 && config.passage) {
      gs.passagesRef.current = [config.passage];
      gs.setPassageMask(
        buildPassageMask(config.dungeonW, config.dungeonH, {
          passages: [config.passage],
        }),
      );
    }

    // Lesson 2: player starts empty-handed so they must brew
    if (lessonIndex === 1) {
      gs.clearHands();
    }

    // Lesson 3: Green Tea at ideal temp, mob starts unconscious
    if (lessonIndex === 2) {
      gs.clearHands();
      gs.addTeaToHand("left", RECIPES[0], 68); // within ideal range [60, 75]
      gs.setMobSatiations([-1]);
      gs.mobSatiationsRef.current = [-1];
    }

    // Override the default game-init message with lesson flavour text
    gs.setMessage(null);
    const id = setTimeout(() => gs.showMsg(config.startMessage), 200);
    return () => clearTimeout(id);
  }, [lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lesson 2: flavour message on first stove interaction ─────────────────

  const shownTeaomaticMsgRef = useRef(false);
  useEffect(() => {
    if (lessonIndex !== 1) {
      shownTeaomaticMsgRef.current = false;
      return;
    }
    if (gs.showRecipeMenu && !shownTeaomaticMsgRef.current) {
      shownTeaomaticMsgRef.current = true;
      gs.showMsg(
        "Most peculiar... a Teaomatic in the afterlife. I suppose one brews what one must.",
      );
    }
  }, [gs.showRecipeMenu, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lesson completion detection ───────────────────────────────────────────

  // Lesson 1: player reaches Room B — camera position reported via callback
  const [cameraPos, setCameraPos] = useState({ x: 0, z: 0 });
  const onCameraStep = useCallback(
    (x: number, z: number) => setCameraPos({ x, z }),
    [],
  );

  useEffect(() => {
    if (lessonIndex !== 0 || lessonDoneRef.current) return;
    const room2 = config.rooms[1];
    if (!room2) return;
    const px = Math.floor(cameraPos.x);
    const pz = Math.floor(cameraPos.z);
    if (
      px >= room2.x &&
      px < room2.x + room2.w &&
      pz >= room2.y &&
      pz < room2.y + room2.h
    ) {
      lessonDoneRef.current = true;
      gs.showMsg("You made it through! The dungeon calls you deeper...");
      setTimeout(() => setLessonIndex(1), 2500);
    }
  }, [cameraPos, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lesson 2: player picks up tea from the Teaomatic
  useEffect(() => {
    if (lessonIndex !== 1 || lessonDoneRef.current) return;
    // Read the ref so we see the synchronous clear written by the per-lesson
    // init effect, not the stale state value from the previous render.
    const hands = gs.playerHandsRef.current; // stays in sync with ECS each render
    if (hands.left || hands.right) {
      lessonDoneRef.current = true;
      gs.showMsg("You almost feel like a person again.");
      setTimeout(() => setLessonIndex(2), 3000);
    }
  }, [gs.leftHandTea, gs.rightHandTea]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lesson 3: unconscious traveller has been revived
  useEffect(() => {
    if (lessonIndex !== 2 || lessonDoneRef.current) return;
    if (gs.mobSatiations[0] > 0) {
      lessonDoneRef.current = true;
      gs.showMsg(
        "They stir... eyes open. 'Thank you, dear ghost. Lead on.' — Tutorial complete!",
      );
      setTimeout(() => {
        // Apply Easy difficulty settings before handing off to the real game
        setTempDropPerStep(0.5);
        setHeatingPerStep(6.0);
        setSatiationDropPerStep(0.1);
        setSupersatiationBonus(50);
        setTurnsPerRound(120);
        setTraversalFactor(2.0);
        setAdventurerDreadRate(0.5);
        setAdventurerLootPerChest(20);
        onComplete();
      }, 4000);
    }
  }, [gs.mobSatiations, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LessonView
      key={lessonIndex}
      lessonIndex={lessonIndex}
      ds={ds}
      gs={gs}
      torchColor={torchColor}
      torchIntensity={torchIntensity}
      keybindings={keybindings}
      onCameraStep={onCameraStep}
    />
  );
}
