import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "./SettingsContext";
import { useDungeonTutorialSetup } from "./hooks/useDungeonTutorialSetup";
import { useGameState } from "./hooks/useGameState";
import { useEotBCamera } from "./hooks/useEotBCamera";
import { GameView } from "./components/GameView";
import { LESSON_CONFIGS, ICE_TEA_INGREDIENT_ID } from "./tutorial/lessons";
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
  winRounds: 999999,
  teaSatiationAmount: 100,
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
  onBlockedMove?: (dx: number, dz: number) => void;
}

function LessonView({
  lessonIndex,
  ds,
  gs,
  torchColor,
  torchIntensity,
  keybindings,
  onCameraStep,
  onBlockedMove,
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
        gs.onTurn();
      },
      blocked: gs.showRecipeMenu || gs.gameState !== "playing",
      onBlockedMove: onBlockedMove ?? gs.onBlockedMove,
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
  const [lessonIndex, setLessonIndex] = useState(0);
  const lessonDoneRef = useRef(false);

  const config = LESSON_CONFIGS[lessonIndex];
  const ds = useDungeonTutorialSetup(lessonIndex);

  const gs = useGameState({
    danceSatiationBoost: ds.danceSatiationBoost,
    dungeon: ds.dungeon,
    solidData: ds.solidData,
    floorData: ds.floorData,
    wallData: ds.wallData,
    ceilingData: ds.ceilingData,
    temperatureData: ds.temperatureData,
    initialMobs: ds.initialMobs,
    adventurerSpawnRooms: [],
    initialIngredientDrops: ds.initialIngredientDrops,
    initialChests: [],
    initialDisarmedTraps: ds.initialDisarmedTraps,
    initialOpenDoors: ds.initialOpenDoors,
    spawnX: ds.spawnX,
    spawnZ: ds.spawnZ,
    spawnYaw: ds.spawnYaw,
    stovePlacements: ds.stovePlacements,
    doorPlacements: ds.doorPlacements,
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

    // Set up hidden passage for lesson 0 (foyer → big room)
    if (lessonIndex === 0 && config.passage) {
      gs.passagesRef.current = [config.passage];
      gs.setPassageMask(
        buildPassageMask(config.dungeonW, config.dungeonH, {
          passages: [config.passage],
        }),
      );
    }

    // Lesson 1: set up passage, mob state, and starting ingredients
    if (lessonIndex === 1) {
      if (config.passage) {
        gs.passagesRef.current = [config.passage];
        gs.setPassageMask(
          buildPassageMask(config.dungeonW, config.dungeonH, {
            passages: [config.passage],
          }),
        );
      }
      gs.clearHands();
      // Give the player one ice-tea ingredient — only ice tea is initially available
      const startIngredients: Record<string, number> = {
        "hot-pepper": 0,
        "frost-leaf": 1,
        "wild-herb": 0,
      };
      gs.applyIngredients(startIngredients);
      // Monster starts unconscious (satiation -1 = gasping/red)
      gs.setMobSatiations([-1]);
      gs.mobSatiationsRef.current = [-1];
    }

    gs.setMessage(null);
    const id = setTimeout(() => gs.showMsg(config.startMessage, true), 200);
    return () => clearTimeout(id);
  }, [lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Camera position ───────────────────────────────────────────────────────

  const [cameraPos, setCameraPos] = useState({ x: 0, z: 0 });
  const onCameraStep = useCallback(
    (x: number, z: number) => setCameraPos({ x, z }),
    [],
  );

  // ── Lesson 0: advance when player enters Room B ──────────────────────────

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
      gs.showMsg("Something draws you deeper into the dungeon...", true);
      setTimeout(() => setLessonIndex(1), 2500);
    }
  }, [cameraPos, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lesson 1 sub-triggers ─────────────────────────────────────────────────

  const firedTriggersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (lessonIndex === 1) firedTriggersRef.current = new Set();
  }, [lessonIndex]);

  // T3: Recipe menu opened for the first time → show hint text
  useEffect(() => {
    if (lessonIndex !== 1 || firedTriggersRef.current.has("T3")) return;
    if (gs.showRecipeMenu) {
      firedTriggersRef.current.add("T3");
    }
  }, [gs.showRecipeMenu, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // T3b: A brew has been started — show timing hint and clear spare ingredients
  useEffect(() => {
    if (lessonIndex !== 1 || firedTriggersRef.current.has("T3b")) return;
    let hasActiveBrew = false;
    for (const [, state] of gs.stoveStates) {
      if (state?.brewing && !state.brewing.ready) {
        hasActiveBrew = true;
        break;
      }
    }
    if (!hasActiveBrew) return;
    firedTriggersRef.current.add("T3b");
    gs.showMsg(
      "This brew will take time — 18 steps.\n" +
        "Time only passes in the dungeon when you move from your current position.\n" +
        'Press "." to force time to advance if you prefer.\n' +
        "Come back later to collect your freshly brewed tea.",
      true,
    );
    // Clear all ingredients so the player can't queue another brew yet
    const empty: Record<string, number> = {
      "hot-pepper": 0,
      "wild-herb": 0,
      "frost-leaf": 0,
    };
    gs.applyIngredients(empty);
  }, [gs.stoveStates, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // T7: Monster revived — drop gold, explain the endgame condition
  useEffect(() => {
    if (lessonIndex !== 1 || firedTriggersRef.current.has("T7")) return;
    if (gs.mobSatiations[0] > 0) {
      firedTriggersRef.current.add("T7");
      gs.showMsg(
        "Here, an adventurer dropped this gold. They make such a mess leaving it lying around.\n" +
          "It's no use to me — whoever heard of monsters carrying gold?\n" +
          "But if you found enough of it, you could persuade a dragon to move in —\n" +
          "that would stop those adventurers once and for all.",
        true,
      );
      // Spawn a gold pile next to the revived monster
      const goldDrop = { id: "tut_gold_0", x: 6, z: 8, amount: 100 };
      gs.setXpDrops((prev: any[]) => [...prev, goldDrop]);
      gs.xpDropsRef.current = [...gs.xpDropsRef.current, goldDrop];
    }
  }, [gs.mobSatiations, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position-based triggers: T4 monster, T5 plant, T6 trap/door, T8 antechamber
  useEffect(() => {
    if (lessonIndex !== 1) return;
    const px = Math.floor(cameraPos.x);
    const pz = Math.floor(cameraPos.z);

    // T4: Near the unconscious monster at (5, 8)
    if (
      !firedTriggersRef.current.has("T4") &&
      Math.abs(px - 5) <= 1 &&
      Math.abs(pz - 8) <= 1
    ) {
      firedTriggersRef.current.add("T4");
      gs.showMsg(
        "This monster is unconscious! Each adventurer type deals a different form of elemental damage.\n" +
          "This monster is suffering from red damage, which can only be healed by blue (ice) tea.\n" +
          "Red tea heals green damage, and green tea heals blue damage.\n" +
          "When your tea has brewed, interact with the monster to revive them.\n" +
          "If all the monsters fall unconscious, adventurers will destroy the TeaOMatic!",
        true,
      );
    }

    // T5: Near the harvestable plant at (8, 8)
    if (
      !firedTriggersRef.current.has("T5") &&
      Math.abs(px - 8) <= 1 &&
      Math.abs(pz - 8) <= 1
    ) {
      firedTriggersRef.current.add("T5");
      gs.showMsg(
        "Some small plants grow in the dungeon — they're quite cute.\n" +
          "I can harvest this and use it in the TeaOMatic to brew different types of tea.",
        true,
      );
      // Unlock all other teas now that the player has seen a plant
      const unlocked = {
        ...gs.ingredientsRef.current,
        "hot-pepper": 1,
        "wild-herb": 1,
        "frost-leaf": 1,
      };
      gs.applyIngredients(unlocked);
    }

    // T6: Near the sprung trap and open door at (10–11, 8)
    if (
      !firedTriggersRef.current.has("T6") &&
      Math.abs(px - 10) <= 1 &&
      Math.abs(pz - 8) <= 1
    ) {
      firedTriggersRef.current.add("T6");
      gs.showMsg(
        "Some careless adventurer has triggered this trap and left the door open.\n" +
          'It won\'t harm us, but we should reset it with "space" so another adventurer can enjoy it.',
        true,
      );
    }

    // T8: Player reaches the antechamber (x ≥ 12, one tile past the door)
    if (!firedTriggersRef.current.has("T8") && px >= 12) {
      firedTriggersRef.current.add("T8");
      gs.showMsg(
        "Wait, there's a button here. It must be a secret passage leading to another part of the dungeon.\n" +
          "Walking through walls is great, but I can't do that while holding tea —\n" +
          "if I interact with this passage I can move around the dungeon quicker.",
        true,
      );
      if (!lessonDoneRef.current) {
        lessonDoneRef.current = true;
        setTimeout(() => {
          setTempDropPerStep(0.5);
          setHeatingPerStep(6.0);
          setSatiationDropPerStep(0.1);
          setSupersatiationBonus(50);
          setTurnsPerRound(120);
          setTraversalFactor(2.0);
          setAdventurerDreadRate(0.5);
          setAdventurerLootPerChest(20);
          onComplete();
        }, 5000);
      }
    }
  }, [cameraPos, lessonIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── T9: Wall-phase blocked while holding tea ──────────────────────────────

  const onBlockedMove = useCallback(
    (dx: number, dz: number) => {
      gs.onBlockedMove(dx, dz);
      if (
        lessonIndex === 1 &&
        (gs.leftHandTea || gs.rightHandTea) &&
        !firedTriggersRef.current.has("T9")
      ) {
        firedTriggersRef.current.add("T9");
        gs.showMsg(
          "Walking through walls is great, but I can't do that while holding tea.",
          true,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessonIndex, gs.leftHandTea, gs.rightHandTea, gs.onBlockedMove],
  );

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
      onBlockedMove={onBlockedMove}
    />
  );
}
