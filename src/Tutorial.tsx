import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "./SettingsContext";
import { useDungeonTutorialSetup } from "./hooks/useDungeonTutorialSetup";
import { useGameState } from "./hooks/useGameState";
import { useEotBCamera } from "./hooks/useEotBCamera";
import { GameView } from "./components/GameView";
import { RECIPES } from "./tea";
import { LESSON_CONFIGS } from "./tutorial/lessons";
import { buildPassageMask } from "../roguelike-mazetools/src/rendering/hiddenPassagesMask";
import { useSoundHelper } from "./hooks/useSoundHelper";
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
  winRounds: 999999,
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
      blocked: gs.showRecipeMenu || gs.gameState !== "playing",
      onBlockedMove: gs.onBlockedMove,
      canPhaseWalls: !gs.leftHandTea && !gs.rightHandTea,
      keybindings,
      startYaw: ds.spawnYaw,
    },
  );

  gs.logicalRef.current = camLogicalRef.current;
  gs.doMoveRef.current = doMove;
  const facingTarget = gs.getFacingTarget(camLogicalRef);
  gs.facingTargetRef.current = facingTarget;

  useEffect(() => {
    onCameraStep(camera.x, camera.z);
  }, [camera.x, camera.z]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameView
      gs={gs}
      ds={ds}
      camera={camera}
      facingTarget={facingTarget}
      dungeonWidth={config.dungeonW}
      dungeonHeight={config.dungeonH}
      torchColor={torchColor}
      torchIntensity={torchIntensity}
      keybindings={keybindings}
      topRight={
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
      }
    />
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
  const { sounds } = useSoundHelper();
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
    hazardData: ds.hazardData,
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
    const hands = gs.playerHandsRef.current;
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
