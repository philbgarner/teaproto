import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { aStar8 } from "../../roguelike-mazetools/src/astar";
import { makeContentRng } from "../../roguelike-mazetools/src/content";
import { generateHiddenPassages } from "../../roguelike-mazetools/src/content";
import { buildTileAtlas } from "../../roguelike-mazetools/src/rendering/tileAtlas";
import {
  buildPassageMask,
  enablePassageInMask,
  disablePassageInMask,
} from "../../roguelike-mazetools/src/rendering/hiddenPassagesMask";
import {
  startPassageTraversal,
  consumePassageStep,
  cancelPassageTraversal,
} from "../../roguelike-mazetools/src/turn/passageTraversal";
import hotkeys from "hotkeys-js";
import { RECIPES } from "../tea";
import type { Tea } from "../tea";
import { useSettings } from "../SettingsContext";
import type { Entity } from "../../roguelike-mazetools/src/examples/ECS/Components";
import { useSoundHelper } from "../hooks/useSoundHelper";
import { getChestKeyCount } from "../../roguelike-mazetools/src/examples/ECS/ObjectDefinition";
import { useMusic } from "./useMusic";
import { useMessage } from "./useMessage";
import {
  ATLAS_SHEET_W,
  ATLAS_SHEET_H,
  TILE_PX,
  CHAR_SHEET_W,
  CHAR_SHEET_H,
  ARCH_COBBLE_UV,
  ARCH_BRICK_UV,
  DOOR_OPEN_UV,
  DOOR_CLOSED_UV,
  DOOR_LOCKED_UV,
  ADVENTURER_TYPES,
  ADVENTURER_TYPE_MAP,
  ADVENTURER_SEEKING_DIALOG,
  GHOST_DIALOG,
  GHOST_DIALOG_WITH_TEA,
  GHOST_SIGHT_RADIUS,
  MOB_TYPE_MAP,
  MOB_HP,
  PLAYER_MAX_HP,
  TURNS_PER_ROUND,
  WIN_ROUNDS,
  STATUS_RGB,
  STATUS_CSS,
  LOS_RADIUS,
  MOB_DEFENSE,
  SPIKE_TRAP_DAMAGE,
} from "../gameConstants";
import {
  normalizeUvRect,
  makeRng,
  loadAtlasTexture,
  makeDoorProto,
  makeTeaomaticProto,
  buildInitialExploredMask,
  hasLineOfSight,
} from "../gameUtils";
import type { DamageNumberData } from "../../roguelike-mazetools/src/rendering/PerspectiveDungeonView";

export interface UseGameStateParams {
  dungeon: any;
  solidData: Uint8Array;
  floorData: Uint8Array;
  wallData: Uint8Array;
  ceilingData: Uint8Array;
  temperatureData: Uint8Array;
  initialMobs: any[];
  adventurerSpawnRooms: { x: number; z: number; dist: number }[];
  initialIngredientDrops: any[];
  initialChests: any[];
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  stovePlacements: any[];
  doorPlacements: any[];
  hazardData: Uint8Array;
  dungeonSeed: number;
  dungeonWidth: number;
  dungeonHeight: number;
  // settings
  tempDropPerStep: number;
  heatingPerStep: number;
  satiationDropPerStep: number;
  supersatiationBonus: number;
  turnsPerRound: number;
  traversalFactor: number;
  adventurerDreadRate: number;
  adventurerLootPerChest: number;
  winRounds: number;
  danceSatiationBoost: number;
  keybindings: any;
}

export function useGameState({
  dungeon,
  solidData,
  floorData,
  wallData,
  ceilingData,
  temperatureData,
  initialMobs,
  adventurerSpawnRooms,
  initialIngredientDrops,
  initialChests,
  spawnX,
  spawnZ,
  spawnYaw,
  stovePlacements,
  doorPlacements,
  hazardData,
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
  keybindings,
}: UseGameStateParams) {
  // Tile atlas + texture
  const atlas = useMemo(
    () => buildTileAtlas(ATLAS_SHEET_W, ATLAS_SHEET_H, TILE_PX, TILE_PX),
    [],
  );
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    loadAtlasTexture().then((t) => {
      setTexture(t);
    });
  }, []);
  const [characterSpriteAtlas, setCharacterSpriteAtlas] = useState<any>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      setCharacterSpriteAtlas({ texture: tex, columns: 1, rows: 1 });
    };
    img.src = `${import.meta.env.BASE_URL}textures/monsters.png`;
  }, []);
  const [iconTexture, setIconTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      setIconTexture(tex);
    };
    img.src = `${import.meta.env.BASE_URL}textures/icons.png`;
  }, []);

  const teaomaticProto = useMemo(
    () => texture && makeTeaomaticProto(texture),
    [texture],
  );
  const doorCobbleProto = useMemo(
    () =>
      texture && makeDoorProto(texture, ARCH_COBBLE_UV[0], ARCH_COBBLE_UV[1]),
    [texture],
  );
  const doorBrickProto = useMemo(
    () => texture && makeDoorProto(texture, ARCH_BRICK_UV[0], ARCH_BRICK_UV[1]),
    [texture],
  );
  const doorOpenProto = useMemo(
    () => texture && makeDoorProto(texture, DOOR_OPEN_UV[0], DOOR_OPEN_UV[1]),
    [texture],
  );
  const doorClosedProto = useMemo(
    () =>
      texture && makeDoorProto(texture, DOOR_CLOSED_UV[0], DOOR_CLOSED_UV[1]),
    [texture],
  );
  const doorLockedProto = useMemo(
    () =>
      texture && makeDoorProto(texture, DOOR_LOCKED_UV[0], DOOR_LOCKED_UV[1]),
    [texture],
  );
  const objectRegistry = useMemo(
    () => ({
      ...(teaomaticProto && { stove: () => teaomaticProto.clone(true) }),
      ...(doorCobbleProto && {
        door_cobble: () => doorCobbleProto.clone(true),
      }),
      ...(doorBrickProto && { door_brick: () => doorBrickProto.clone(true) }),
      ...(doorOpenProto && {
        door_state_open: () => doorOpenProto.clone(true),
      }),
      ...(doorClosedProto && {
        door_state_closed: () => doorClosedProto.clone(true),
      }),
      ...(doorLockedProto && {
        door_state_locked: () => doorLockedProto.clone(true),
      }),
    }),
    [
      teaomaticProto,
      doorCobbleProto,
      doorBrickProto,
      doorOpenProto,
      doorClosedProto,
      doorLockedProto,
    ],
  );

  // ---------------------------------------------------------------------------
  // ECS hand inventory
  // ---------------------------------------------------------------------------
  const { playerData } = useSettings();
  const {
    registry,
    leftHand: leftHandInventory,
    rightHand: rightHandInventory,
  } = playerData.ecsData;

  // Version counter — incremented whenever ECS hand state mutates so React re-renders.
  const [handsVersion, setHandsVersion] = useState(0);

  function getHandInventory(hand: "left" | "right"): Entity {
    return hand === "left" ? leftHandInventory : rightHandInventory;
  }

  function getTeaFromHandInventory(handInventory: Entity): Tea | null {
    const inv = registry.components.inventory.get(handInventory);
    if (!inv?.slots[0]) return null;
    const slot = registry.components.inventorySlot.get(inv.slots[0]);
    if (!slot?.object) return null;
    const entity = slot.object;
    const teaComp = registry.components.tea.get(entity);
    const tempComp = registry.components.temperature.get(entity);
    const descComp = registry.components.description.get(entity);
    if (!teaComp || !tempComp || !descComp) return null;
    const recipe = RECIPES.find((r) => r.id === teaComp.recipeId);
    if (!recipe) return null;
    return {
      id: String(entity),
      name: descComp.name,
      recipe,
      temperature: tempComp.currentTemperature,
      ruined: teaComp.ruined,
    };
  }

  function addTeaToHand(
    hand: "left" | "right",
    recipe: (typeof RECIPES)[number],
    temperature: number,
  ) {
    sounds.teacup.play();
    const handInventory = getHandInventory(hand);
    const entity = registry.createEntity();
    registry.components.description.add(entity, { name: recipe.name });
    registry.components.temperature.add(entity, {
      currentTemperature: temperature,
      minTemperature: recipe.idealTemperatureRange[0],
      maxTemperature: recipe.idealTemperatureRange[1],
    });
    registry.components.tea.add(entity, { recipeId: recipe.id, ruined: false });
    // Mark as instance so it won't stack with other tea entities
    registry.components.objectInstance.add(entity, { definition: entity });
    registry.addObjectToInventory(handInventory, entity, 1);
    setHandsVersion((v) => v + 1);
  }

  function removeTeaFromHand(hand: "left" | "right") {
    sounds.teacup.play();
    const handInventory = getHandInventory(hand);
    const inv = registry.components.inventory.get(handInventory);
    if (!inv?.slots[0]) return;
    const slot = registry.components.inventorySlot.get(inv.slots[0]);
    if (!slot?.object) return;
    const entity = slot.object;
    registry.removeObjectFromSlot(inv.slots[0]);
    registry.removeEntity(entity);
    setHandsVersion((v) => v + 1);
  }

  function clearHands() {
    removeTeaFromHand("left");
    removeTeaFromHand("right");
  }

  // Derived hand tea values (reactive via handsVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const leftHandTea = useMemo(
    () => getTeaFromHandInventory(leftHandInventory),
    [leftHandInventory, handsVersion],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rightHandTea = useMemo(
    () => getTeaFromHandInventory(rightHandInventory),
    [rightHandInventory, handsVersion],
  );

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const [mobSatiations, setMobSatiations] = useState<number[]>(() =>
    initialMobs.map(() => 40),
  );
  const [mobHps, setMobHps] = useState<number[]>(() =>
    initialMobs.map((m) => m.hp ?? MOB_HP),
  );
  const [mobPositions, setMobPositions] = useState<{ x: number; z: number }[]>(
    () => initialMobs.map((m) => ({ x: m.x, z: m.z })),
  );
  const mobPositionsRef = useRef(mobPositions);
  const [mobRpsEffects, setMobRpsEffects] = useState<string[]>(() =>
    initialMobs.map(() => "none"),
  );
  const mobStatuses = useMemo(
    () =>
      mobSatiations.map((s) =>
        s > 100
          ? "ecstatic"
          : s >= 75
            ? "refreshed"
            : s >= 50
              ? "sated"
              : s >= 25
                ? "thirsty"
                : "gasping",
      ),
    [mobSatiations],
  );
  // stoveStates: Map<"x_z", { brewing: null | { recipe, stepsRemaining, ready } }>
  const [stoveStates, setStoveStates] = useState<Map<string, any>>(
    () => new Map(),
  );
  const [showRecipeMenu, setShowRecipeMenu] = useState(false);
  const [recipeMenuCursor, setRecipeMenuCursor] = useState(0);
  const [activeStoveKey, setActiveStoveKey] = useState<string | null>(null);
  const [showSummonMenu, setShowSummonMenu] = useState(false);
  const [summonMenuCursor, setSummonMenuCursor] = useState(0);
  const { message, displayedText, setMessage, showMsg } = useMessage();
  const ruinedNotifiedRef = useRef(new Set<string>());

  // ---------------------------------------------------------------------------
  // Speech bubbles — keyed by entity id; position looked up from live state
  // ---------------------------------------------------------------------------
  const [speechBubbles, setSpeechBubbles] = useState<
    Record<string, { text: string }>
  >({}); // { [entityId]: { text } }
  const speechBubbleTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const speechBubblesRef = useRef<Record<string, { text: string }>>({});

  const showSpeechBubble = useCallback(
    (entityId: string, text: string, duration = 6000) => {
      setSpeechBubbles((prev) => ({ ...prev, [entityId]: { text } }));
      speechBubblesRef.current = {
        ...speechBubblesRef.current,
        [entityId]: { text },
      };
      if (speechBubbleTimersRef.current[entityId]) {
        clearTimeout(speechBubbleTimersRef.current[entityId]);
      }
      speechBubbleTimersRef.current[entityId] = setTimeout(() => {
        setSpeechBubbles((prev) => {
          const next = { ...prev };
          delete next[entityId];
          return next;
        });
        const nextRef = { ...speechBubblesRef.current };
        delete nextRef[entityId];
        speechBubblesRef.current = nextRef;
        delete speechBubbleTimersRef.current[entityId];
      }, duration);
    },
    [],
  );
  // Map<regionId, cumulativeRise> — only regions containing cozy objects heat up
  const [roomTempRise, setRoomTempRise] = useState<Map<number, number>>(
    () => new Map(),
  );
  const regionIdData = useMemo(() => dungeon.fullRegionIds, [dungeon]);

  // Precompute unique adjacent region pairs for temperature flow.
  const regionAdjacency = useMemo(() => {
    // Build set of cell boundaries blocked by doors.
    const blockedBoundaries = new Set<string>();
    for (const door of doorPlacements) {
      const dx = door.meta?.blockDx ?? 0;
      const dz = door.meta?.blockDz ?? 0;
      const x1 = door.x,
        z1 = door.z;
      const x2 = door.x + dx,
        z2 = door.z + dz;
      if (z1 < z2 || (z1 === z2 && x1 < x2)) {
        blockedBoundaries.add(`${x1},${z1},${x2},${z2}`);
      } else {
        blockedBoundaries.add(`${x2},${z2},${x1},${z1}`);
      }
    }

    const pairs = new Set<string>();
    const W = dungeonWidth;
    const H = dungeonHeight;
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        if (solidData[i] !== 0) continue;
        const a = regionIdData[i];
        // right neighbor
        if (x + 1 < W && solidData[i + 1] === 0) {
          const b = regionIdData[i + 1];
          if (a !== b && !blockedBoundaries.has(`${x},${z},${x + 1},${z}`)) {
            pairs.add(a < b ? `${a},${b}` : `${b},${a}`);
          }
        }
        // down neighbor
        if (z + 1 < H && solidData[i + W] === 0) {
          const b = regionIdData[i + W];
          if (a !== b && !blockedBoundaries.has(`${x},${z},${x},${z + 1}`)) {
            pairs.add(a < b ? `${a},${b}` : `${b},${a}`);
          }
        }
      }
    }
    const result = Array.from(pairs).map((s) => s.split(",").map(Number));
    return result;
  }, [
    // dungeon,
    solidData,
    regionIdData,
    dungeonWidth,
    dungeonHeight,
    doorPlacements,
  ]);

  const dynamicTempData = useMemo(() => {
    const out = new Uint8Array(temperatureData.length);
    for (let i = 0; i < temperatureData.length; i++) {
      if (solidData[i] !== 0) continue;
      const regionId = regionIdData[i];
      const rise = Math.round(roomTempRise.get(regionId) ?? 0);
      out[i] = Math.min(255, temperatureData[i] + rise);
    }
    return out;
  }, [temperatureData, solidData, regionIdData, roomTempRise]);

  const [showSettings, setShowSettings] = useState(false);
  const [showTempTint, setShowTempTint] = useState(false);

  // Door states
  type DoorState = "open" | "closed" | "locked";
  const [doorStates, setDoorStates] = useState<Map<string, DoorState>>(() => {
    const m = new Map<string, DoorState>();
    for (const d of doorPlacements) {
      m.set(`${d.x}_${d.z}`, "closed");
    }
    return m;
  });
  const doorStatesRef = useRef(doorStates);
  doorStatesRef.current = doorStates;

  // Chests state
  const [chests, setChests] = useState<any[]>([]);
  const chestsRef = useRef<any[]>([]);

  // Round / combat state
  const [adventurers, setAdventurers] = useState<any[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [roundCountdown, setRoundCountdown] = useState(TURNS_PER_ROUND);
  const [playerXp, setPlayerXp] = useState(0);
  const [xpDrops, setXpDrops] = useState<any[]>([]);
  const [playerHp, setPlayerHp] = useState(PLAYER_MAX_HP);

  // Combat animation state
  const [mobDamageFlash, setMobDamageFlash] = useState<boolean[]>(() =>
    initialMobs.map(() => false),
  );
  const mobDamageFlashRef = useRef<boolean[]>(initialMobs.map(() => false));
  const [advDamageFlash, setAdvDamageFlash] = useState<boolean[]>([]);
  const [mobAttackDirs, setMobAttackDirs] = useState<
    Array<{ dx: number; dz: number } | null>
  >(() => initialMobs.map(() => null));
  const [advAttackDirs, setAdvAttackDirs] = useState<
    Array<{ dx: number; dz: number } | null>
  >([]);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [disarmedTraps, setDisarmedTraps] = useState<Set<string>>(
    () => new Set(),
  );
  const disarmedTrapsRef = useRef<Set<string>>(new Set());

  // Ingredient inventory  { rations: 0, herbs: 0, dust: 0 }
  const [ingredients, setIngredients] = useState<Record<string, number>>({
    rations: 0,
    herbs: 0,
    dust: 0,
  });
  const [ingredientDrops, setIngredientDrops] = useState<any[]>([]);

  // Game-flow state
  const [gameState, setGameState] = useState<"playing" | "gameover" | "won">(
    "playing",
  );
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);

  // Refs for synchronous cross-state access during game step processing
  const adventurersRef = useRef<any[]>([]);
  const currentRoundRef = useRef(0);
  const turnCountRef = useRef(0);
  const roundCountdownRef = useRef(TURNS_PER_ROUND);
  const playerXpRef = useRef(0);
  const xpDropsRef = useRef<any[]>([]);
  const playerHpRef = useRef(PLAYER_MAX_HP);
  const ingredientsRef = useRef<Record<string, number>>({
    rations: 0,
    herbs: 0,
    dust: 0,
  });
  const ingredientDropsRef = useRef<any[]>([]);
  // Sync ref kept in step with ECS hand state so onStep can read without a dep
  const playerHandsRef = useRef<{ left: Tea | null; right: Tea | null }>({
    left: null,
    right: null,
  });
  playerHandsRef.current = { left: leftHandTea, right: rightHandTea };

  const adventurerDreadRateRef = useRef(1.0);
  adventurerDreadRateRef.current = adventurerDreadRate;
  const adventurerLootPerChestRef = useRef(10);
  adventurerLootPerChestRef.current = adventurerLootPerChest;
  const roomTempRiseRef = useRef<Map<number, number>>(new Map());
  roomTempRiseRef.current = roomTempRise;

  // Explored mask — Uint8Array(W*H), 1 = cell has been seen by the player
  const exploredMaskRef = useRef<Uint8Array | null>(null);
  const firstTeaDeliveredRef = useRef(false);
  const firstWarmRoomTeaRef = useRef(false);

  // Track which adventurers have already reacted to spotting the ghost (player)
  const adventurerSightingsRef = useRef(new Set<string>());

  // initialMobs is stable (useMemo on []), so we can read it from a ref too
  const mobSatiationsRef = useRef<number[] | null>(null);
  if (mobSatiationsRef.current === null) {
    mobSatiationsRef.current = initialMobs.map(() => 40);
  }
  const mobHpsRef = useRef<number[] | null>(null);
  if (mobHpsRef.current === null) {
    mobHpsRef.current = initialMobs.map((m) => m.hp ?? MOB_HP);
  }
  const mobRpsEffectsRef = useRef<string[]>(initialMobs.map(() => "none"));
  const mobSummonSet = useRef<Map<number, { x: number; z: number }>>(new Map());

  // Dance tracking: counts consecutive q/e turns while sharing a cell with a mob/adventurer
  const danceStateRef = useRef<{
    mobIdx: number | null;
    advId: string | null;
    count: number;
  }>({ mobIdx: null, advId: null, count: 0 });

  // Hidden passages
  const passagesRef = useRef<any[]>([]);
  const [passageMask, setPassageMask] = useState<Uint8Array | null>(null);
  const [passageTraversal, _setPassageTraversal] = useState<any>({
    kind: "idle",
  });
  const passageTraversalRef = useRef<any>({ kind: "idle" });
  function setPassageTraversal(s: any) {
    passageTraversalRef.current = s;
    _setPassageTraversal(s);
  }
  const traversalFactorRef = useRef(2.0);
  useEffect(() => {
    traversalFactorRef.current = traversalFactor;
  }, [traversalFactor]);
  const traversalStartRef = useRef({ totalSteps: 0, factor: 2.0 });

  const { sounds } = useSoundHelper();

  // Reset all game state whenever the dungeon regenerates
  useEffect(() => {
    const freshSatiations = initialMobs.map(() => 40);
    const freshHps = initialMobs.map((m: any) => m.hp ?? MOB_HP);
    clearHands();
    addTeaToHand("left", RECIPES[0], 90);
    setMobSatiations(freshSatiations);
    setMobHps(freshHps);
    const freshRpsEffects = initialMobs.map(() => "none");
    setMobRpsEffects(freshRpsEffects);
    mobRpsEffectsRef.current = freshRpsEffects;
    setStoveStates(new Map());
    setShowRecipeMenu(false);
    setActiveStoveKey(null);
    setMessage(null);
    setAdventurers([]);
    setCurrentRound(0);
    setTurnCount(0);
    setRoundCountdown(turnsPerRound);
    setPlayerXp(0);
    setXpDrops([]);
    setPlayerHp(PLAYER_MAX_HP);
    setMobDamageFlash(initialMobs.map(() => false));
    mobDamageFlashRef.current = initialMobs.map(() => false);
    setAdvDamageFlash([]);
    setMobAttackDirs(initialMobs.map(() => null));
    setAdvAttackDirs([]);
    setDamageNumbers([]);
    setIngredients({ rations: 0, herbs: 0, dust: 0 });
    setIngredientDrops([...initialIngredientDrops]);
    setChests([...initialChests]);
    chestsRef.current = [...initialChests];
    setGameState("playing");
    setGameOverReason(null);
    adventurersRef.current = [];
    currentRoundRef.current = 0;
    turnCountRef.current = 0;
    roundCountdownRef.current = turnsPerRound;
    playerXpRef.current = 0;
    xpDropsRef.current = [];
    playerHpRef.current = PLAYER_MAX_HP;
    ingredientsRef.current = { rations: 0, herbs: 0, dust: 0 };
    ingredientDropsRef.current = [...initialIngredientDrops];
    mobSatiationsRef.current = freshSatiations;
    mobHpsRef.current = freshHps;
    const freshPositions = initialMobs.map((m) => ({ x: m.x, z: m.z }));
    setMobPositions(freshPositions);
    mobPositionsRef.current = freshPositions;
    ruinedNotifiedRef.current = new Set();
    adventurerSightingsRef.current = new Set();
    mobSummonSet.current = new Map();
    firstTeaDeliveredRef.current = false;
    firstWarmRoomTeaRef.current = false;

    // Pre-explore exactly: kitchen (startRoomId) + one monster room + connecting corridor
    exploredMaskRef.current = buildInitialExploredMask(
      dungeon,
      dungeonWidth,
      dungeonHeight,
    );

    // Regenerate hidden passages
    const rng = makeContentRng(dungeonSeed ^ 0xabcdef);
    const { passages } = generateHiddenPassages(dungeon, rng, { count: 2 });
    passagesRef.current = passages;
    setPassageMask(
      buildPassageMask(dungeon.width, dungeon.height, { passages }),
    );
    setPassageTraversal({ kind: "idle" });

    sounds.mainThemeDungeon.play();
    showMsg(
      "You have a Green Tea in hand — find the thirsty monsters and deliver it! (Press [space] Key)",
    );
  }, [dungeon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setChests([...initialChests]);
    chestsRef.current = [...initialChests];
  }, [initialChests]);

  const mobiles = useMemo(() => {
    if (mobPositions.length !== initialMobs.length) return [];
    return [
      ...initialMobs.map((m, i) => {
        const tmpl = MOB_TYPE_MAP[m.type];
        return {
          x: mobPositions[i].x,
          z: mobPositions[i].z,
          type: "mob",
          tileId: 0,
          color:
            mobHps[i] <= 0
              ? [0.25, 0.25, 0.25]
              : (STATUS_RGB[mobStatuses[i]] ?? STATUS_RGB.thirsty),
          geometrySize: tmpl?.geometrySize,
          uvRectBody: normalizeUvRect(
            tmpl?.uvRectBody,
            CHAR_SHEET_W,
            CHAR_SHEET_H,
          ),
          uvRectHead: normalizeUvRect(
            tmpl?.uvRectHead,
            CHAR_SHEET_W,
            CHAR_SHEET_H,
          ),
          unconscious: mobHps[i] <= 0,
        };
      }),
      ...adventurers
        .filter((a) => a.alive)
        .map((a) => {
          const tmpl = ADVENTURER_TYPE_MAP[a.template];
          return {
            x: a.x,
            z: a.z,
            type: "adventurer",
            tileId: 1,
            color: a.colorRgb,
            geometrySize: tmpl?.geometrySize,
            uvRectBody: normalizeUvRect(
              tmpl?.uvRectBody,
              CHAR_SHEET_W,
              CHAR_SHEET_H,
            ),
            uvRectHead: normalizeUvRect(
              tmpl?.uvRectHead,
              CHAR_SHEET_W,
              CHAR_SHEET_H,
            ),
          };
        }),
    ];
  }, [
    initialMobs,
    mobPositions,
    mobStatuses,
    mobSatiations,
    mobHps,
    adventurers,
  ]);

  // Resolve speech bubbles: look up current entity positions so bubbles follow movers
  const activeSpeechBubbles = useMemo(() => {
    return Object.entries(speechBubbles).flatMap(([entityId, bubble]) => {
      let x: number, z: number, speakerName: string;
      if (entityId.startsWith("mob_")) {
        const idx = parseInt(entityId.slice(4), 10);
        const mob = initialMobs[idx];
        if (!mob || !mobPositions[idx]) return [];
        x = mobPositions[idx].x;
        z = mobPositions[idx].z;
        speakerName = mob.name;
      } else {
        const adv = adventurers.find((a) => a.id === entityId && a.alive);
        if (!adv) return [];
        x = adv.x;
        z = adv.z;
        speakerName = adv.name;
      }
      return [{ id: entityId, x, z, text: bubble.text, speakerName }];
    });
  }, [speechBubbles, initialMobs, mobPositions, adventurers]);

  const spawnAdventurersForRound = useCallback(
    (roundNum: number) => {
      const count = Math.min(1 + roundNum, 6);
      const spawned: any[] = [];
      // Block tiles occupied by alive adventurers or mobs
      const occupied = new Set([
        ...adventurersRef.current
          .filter((a) => a.alive)
          .map((a) => `${a.x}_${a.z}`),
        ...mobPositionsRef.current.map((p) => `${p.x}_${p.z}`),
      ]);
      // Spawn all adventurers from the startRoom (adventurerSpawnRooms[0])
      const room = adventurerSpawnRooms[0];
      if (!room) return spawned;
      for (let i = 0; i < count; i++) {
        const tmpl = ADVENTURER_TYPES[i % ADVENTURER_TYPES.length];
        // Spiral outward from room center to find a free floor tile
        let spawnX = -1;
        let spawnZ = -1;
        outer: for (let r = 0; r <= 8; r++) {
          for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
              const tx = room.x + dx;
              const tz = room.z + dz;
              if (
                tx < 1 ||
                tz < 1 ||
                tx >= dungeonWidth - 1 ||
                tz >= dungeonHeight - 1
              )
                continue;
              if (solidData[tz * dungeonWidth + tx] !== 0) continue;
              const key = `${tx}_${tz}`;
              if (!occupied.has(key)) {
                spawnX = tx;
                spawnZ = tz;
                break outer;
              }
            }
          }
        }
        if (spawnX === -1) continue;
        occupied.add(`${spawnX}_${spawnZ}`);
        const lootRng = makeRng(roundNum * 31337 + i * 7919 + 1);
        const dreadRng = makeRng(roundNum * 31337 + i * 7919 + 2);
        spawned.push({
          id: `adv_r${roundNum}_${i}`,
          name: tmpl.name,
          x: spawnX,
          z: spawnZ,
          alive: true,
          hp: tmpl.hp + (roundNum - 1) * 3,
          maxHp: tmpl.hp + (roundNum - 1) * 3,
          attack: tmpl.attack + Math.floor((roundNum - 1) / 2),
          defense: tmpl.defense,
          xp: tmpl.xp + (roundNum - 1) * 5,
          template: tmpl.type,
          colorRgb: tmpl.colorRgb,
          state: "exploring",
          loot: 0,
          dread: 0,
          lootThreshold: 20 + Math.floor(lootRng() * 31),
          dreadThreshold: 15 + Math.floor(dreadRng() * 26),
          noLootTurns: 0,
          rpsEffect: tmpl.rpsEffect,
        });
      }
      return spawned;
    },
    [adventurerSpawnRooms, dungeonHeight, dungeonWidth, solidData],
  );

  // logicalRef is provided by useEotBCamera — we need a ref to it here so onStep can
  // read the player position. We forward this via a ref that App.tsx will wire up.
  const logicalRef = useRef<{ x: number; z: number; yaw: number }>({
    x: spawnX,
    z: spawnZ,
    yaw: spawnYaw,
  });

  // On each player step: cool tea, count down brewing, run game loop
  const onStep = useCallback(() => {
    if (gameState !== "playing") return;

    // --- Dance resolution: player moves away after 3+ turns with a co-located entity ---
    {
      const ds = danceStateRef.current;
      if (ds.count >= 3) {
        if (ds.mobIdx !== null) {
          const mobEntityId = `mob_${ds.mobIdx}`;
          showSpeechBubble(
            mobEntityId,
            "Thank you for the dance, dear ghost!",
            6000,
          );
          setMobSatiations((prev) => {
            const next = [...prev];
            next[ds.mobIdx!] = Math.min(150, next[ds.mobIdx!] + danceSatiationBoost);
            return next;
          });
        } else if (ds.advId !== null) {
          showSpeechBubble(
            ds.advId,
            "Most peculiar... dancing with a phantom!",
            6000,
          );
        }
      }
      danceStateRef.current = { mobIdx: null, advId: null, count: 0 };
    }

    // --- Tea cooling ---
    // Check if player is in a warm or cozy room (roomTemp > 127)
    {
      const { x: cx, z: cz } = logicalRef.current;
      const cgx = Math.floor(cx);
      const cgz = Math.floor(cz);
      const playerRegionId = regionIdData[cgz * dungeonWidth + cgx];
      const playerBaseTemp = temperatureData[cgz * dungeonWidth + cgx] ?? 127;
      const playerRoomRise = roomTempRiseRef.current.get(playerRegionId) ?? 0;
      const playerRoomTemp = Math.min(
        255,
        playerBaseTemp + Math.round(playerRoomRise),
      );
      const inWarmRoom = playerRoomTemp > 127;

      const hands = playerHandsRef.current;
      const carryingTea = hands.left || hands.right;
      if (inWarmRoom && carryingTea && !firstWarmRoomTeaRef.current) {
        firstWarmRoomTeaRef.current = true;
        showMsg(
          "The warmth of this room keeps your tea from cooling too much — it won't drop below mid-range here!",
        );
      }

      {
        let handsChanged = false;
        for (const handInventory of [leftHandInventory, rightHandInventory]) {
          const inv = registry.components.inventory.get(handInventory);
          if (!inv?.slots[0]) continue;
          const slot = registry.components.inventorySlot.get(inv.slots[0]);
          if (!slot?.object) continue;
          const entity = slot.object;
          const tempComp = registry.components.temperature.get(entity);
          const teaComp = registry.components.tea.get(entity);
          if (!tempComp || !teaComp) continue;
          const rawTemp = tempComp.currentTemperature - tempDropPerStep;
          const newTemp = inWarmRoom
            ? Math.max(
                rawTemp,
                (tempComp.minTemperature + tempComp.maxTemperature) / 2,
              )
            : rawTemp;
          tempComp.currentTemperature = newTemp;
          handsChanged = true;
        }
        if (handsChanged) setHandsVersion((v) => v + 1);
      }
    }

    // --- Stove brewing countdown ---
    setStoveStates((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [key, state] of next) {
        if (!state.brewing || state.brewing.ready) continue;
        const steps = state.brewing.stepsRemaining - 1;
        if (steps <= 0) {
          next.set(key, {
            brewing: { ...state.brewing, stepsRemaining: 0, ready: true },
          });
          sounds.tea_ready.play();
        } else {
          next.set(key, {
            brewing: { ...state.brewing, stepsRemaining: steps },
          });
        }
        changed = true;
      }
      return changed ? new Map(next) : prev;
    });

    // --- Game step processing (uses refs for synchronous cross-state reads) ---
    console.log("[onStep] tea cooling done, starting turn processing");
    const newTurnCount = turnCountRef.current + 1;
    turnCountRef.current = newTurnCount;

    let newAdventurers = [...adventurersRef.current];
    let newMobSatiations = mobSatiationsRef.current!.map((s) =>
      Math.max(0, s - satiationDropPerStep),
    );
    let newMobHps = mobHpsRef.current!.map((h) => h);
    let newMobRpsEffects = mobRpsEffectsRef.current.map((e) => e);
    let newMobPositions = mobPositionsRef.current.map((p) => ({ ...p }));
    let newRound = currentRoundRef.current;
    let newPlayerXp = playerXpRef.current;
    let newXpDrops = [...xpDropsRef.current];
    let newPlayerHp = playerHpRef.current;
    let newIngredients = { ...ingredientsRef.current };
    let newIngredientDrops = [...ingredientDropsRef.current];
    let newChests = [...chestsRef.current];
    let stepMessage: string | null = null;
    const pendingSpeechBubbles: { entityId: string; text: string }[] = []; // collected during processing
    // Combat animation event accumulators
    const advAttackEvents: { advId: string; dx: number; dz: number }[] = [];
    const mobHitEvents: {
      mobIdx: number;
      damage: number;
      x: number;
      z: number;
    }[] = [];
    const mobAttackEventsLocal: { mobIdx: number; dx: number; dz: number }[] =
      [];
    const advHitEvents: {
      advId: string;
      damage: number;
      x: number;
      z: number;
    }[] = [];

    // --- Round spawning ---
    console.log(
      "[onStep] round spawning check, turn:",
      newTurnCount,
      "countdown:",
      roundCountdownRef.current,
    );
    let newRoundCountdown = roundCountdownRef.current - 1;
    if (newRoundCountdown <= 0) {
      newRoundCountdown = turnsPerRound;
      newRound = currentRoundRef.current + 1;
      currentRoundRef.current = newRound;
      const spawned = spawnAdventurersForRound(newRound);
      newAdventurers = [...newAdventurers.filter((a) => a.alive), ...spawned];
      stepMessage = `Round ${newRound}! ${spawned.length} adventurer${spawned.length !== 1 ? "s" : ""} have entered the dungeon!`;
    }
    roundCountdownRef.current = newRoundCountdown;

    // --- XP pickup (before moving to avoid collecting just-dropped XP) ---
    const { x: px, z: pz } = logicalRef.current;
    const pgx = Math.floor(px);
    const pgz = Math.floor(pz);
    const remainingDrops: any[] = [];
    let xpGained = 0;
    for (const drop of newXpDrops) {
      if (drop.x === pgx && drop.z === pgz) {
        xpGained += drop.amount;
      } else {
        remainingDrops.push(drop);
      }
    }
    if (xpGained > 0) {
      newPlayerXp += xpGained;
      stepMessage = `Collected ${xpGained} gold! (Total: ${newPlayerXp})`;
      sounds.coins.play();
    }
    newXpDrops = remainingDrops;

    // --- Ingredient pickup ---
    const remainingIngDrops: any[] = [];
    for (const drop of newIngredientDrops) {
      if (drop.x === pgx && drop.z === pgz) {
        newIngredients = {
          ...newIngredients,
          [drop.id]: (newIngredients[drop.id] ?? 0) + 1,
        };
        stepMessage = `Collected ${drop.name}!`;
      } else {
        remainingIngDrops.push(drop);
      }
    }
    newIngredientDrops = remainingIngDrops;

    // --- Adventurer AI ---
    function isWalkable(x: number, z: number): boolean {
      if (x < 0 || z < 0 || x >= dungeonWidth || z >= dungeonHeight)
        return false;
      return solidData[z * dungeonWidth + x] === 0;
    }

    // Closed/locked doors block LOS. Open doors never block.
    const stepOccupied = new Set([
      `${pgx}_${pgz}`,
      ...newMobPositions.map((p) => `${p.x}_${p.z}`),
      ...newAdventurers.filter((a) => a.alive).map((a) => `${a.x}_${a.z}`),
    ]);
    const closedDoorCells = new Set(
      doorPlacements
        .filter((d) => {
          const state = doorStatesRef.current.get(`${d.x}_${d.z}`) ?? "closed";
          if (state === "open") return false;
          if (state === "locked") return true;
          return !stepOccupied.has(`${d.x}_${d.z}`);
        })
        .map((d) => `${d.x}_${d.z}`),
    );

    // Auto-open door when player steps onto it
    const playerDoorKey = `${pgx}_${pgz}`;
    if (doorStatesRef.current.has(playerDoorKey)) {
      const playerDoorState =
        doorStatesRef.current.get(playerDoorKey) ?? "closed";
      if (playerDoorState === "closed") {
        setDoorStates((prev) => new Map(prev).set(playerDoorKey, "open"));
        sounds.slideUp.play();
      }
    }
    function isWalkableForLos(x: number, z: number): boolean {
      if (!isWalkable(x, z)) return false;
      return !closedDoorCells.has(`${x}_${z}`);
    }

    // Update explored mask: mark all cells visible from current player position
    if (exploredMaskRef.current) {
      const mask = exploredMaskRef.current;
      for (let dz = -LOS_RADIUS; dz <= LOS_RADIUS; dz++) {
        for (let dx = -LOS_RADIUS; dx <= LOS_RADIUS; dx++) {
          if (dx * dx + dz * dz > LOS_RADIUS * LOS_RADIUS) continue;
          const tx = pgx + dx;
          const tz = pgz + dz;
          if (tx < 0 || tz < 0 || tx >= dungeonWidth || tz >= dungeonHeight)
            continue;
          if (hasLineOfSight(pgx, pgz, tx, tz, isWalkableForLos)) {
            mask[tz * dungeonWidth + tx] = 1;
          }
        }
      }
    }

    // Phase 1 — compute intended moves (adventurers are transparent to each other)
    console.log(
      "[onStep] Phase 1: adventurer AI, count:",
      newAdventurers.filter((a) => a.alive).length,
    );
    const mobPlayerOccupied = new Set([
      ...newMobPositions.map((p) => `${p.x}_${p.z}`),
    ]);

    const intendedMoves = newAdventurers.map((advInit) => {
      let adv = advInit;
      if (!adv.alive)
        return {
          adv,
          intendedX: adv.x,
          intendedZ: adv.z,
          debugPath: [],
          isAttack: false,
          inCombat: false,
        };

      // Ghost sighting: adventurer spots the ghost (player) for the first time
      if (!adventurerSightingsRef.current.has(adv.id)) {
        const playerDist = Math.hypot(adv.x - pgx, adv.z - pgz);
        if (
          playerDist <= GHOST_SIGHT_RADIUS &&
          hasLineOfSight(adv.x, adv.z, pgx, pgz, isWalkableForLos)
        ) {
          adventurerSightingsRef.current.add(adv.id);
          const hasTeaInHand = !!(
            playerHandsRef.current.left || playerHandsRef.current.right
          ); // playerHandsRef is kept in sync with ECS each render
          const pool = hasTeaInHand ? GHOST_DIALOG_WITH_TEA : GHOST_DIALOG;
          pendingSpeechBubbles.push({
            entityId: adv.id,
            text: pool[Math.floor(Math.random() * pool.length)],
          });
        }
      }

      // Factions: adventurers are hostile to monsters, neutral to player.
      // Priority: fight any conscious monster in line of sight; otherwise use state machine.

      // Find nearest visible (line-of-sight) conscious monster
      let combatTarget: {
        x: number;
        z: number;
        type: string;
        idx: number;
      } | null = null;
      let combatDist = Infinity;
      for (let i = 0; i < initialMobs.length; i++) {
        if (newMobHps[i] <= 0) continue; // unconscious
        const mobPos = newMobPositions[i];
        const d = Math.hypot(adv.x - mobPos.x, adv.z - mobPos.z);
        if (
          d < combatDist &&
          hasLineOfSight(adv.x, adv.z, mobPos.x, mobPos.z, isWalkableForLos)
        ) {
          combatDist = d;
          combatTarget = { x: mobPos.x, z: mobPos.z, type: "mob", idx: i };
        }
      }

      if (combatTarget) {
        // Adjacent to monster: attack
        const ddx = combatTarget.x - adv.x;
        const ddz = combatTarget.z - adv.z;
        if (Math.abs(ddx) + Math.abs(ddz) === 1) {
          const damage = Math.max(1, adv.attack - MOB_DEFENSE);
          if (newMobSatiations[combatTarget.idx] > 0) {
            newMobSatiations[combatTarget.idx] = Math.max(
              0,
              newMobSatiations[combatTarget.idx] - damage,
            );
          } else {
            newMobHps[combatTarget.idx] = Math.max(
              0,
              newMobHps[combatTarget.idx] - damage,
            );
            if (newMobHps[combatTarget.idx] <= 0) {
              stepMessage = `${initialMobs[combatTarget.idx].name} has fallen unconscious!`;
            }
          }
          if ((adv as any).rpsEffect && (adv as any).rpsEffect !== "none") {
            newMobRpsEffects[combatTarget.idx] = (adv as any).rpsEffect;
          }
          advAttackEvents.push({ advId: adv.id, dx: ddx, dz: ddz });
          mobHitEvents.push({
            mobIdx: combatTarget.idx,
            damage,
            x: combatTarget.x,
            z: combatTarget.z,
          });
          return {
            adv,
            intendedX: adv.x,
            intendedZ: adv.z,
            debugPath: [],
            isAttack: true,
            inCombat: true,
          };
        }
        // Move toward monster
        const combatAstar = aStar8(
          { width: dungeonWidth, height: dungeonHeight },
          (x: number, y: number) => isWalkable(x, y),
          { x: adv.x, y: adv.z },
          { x: combatTarget.x, y: combatTarget.z },
          {
            isBlocked: (x: number, y: number) => {
              const isLockedDoor =
                doorStatesRef.current.get(`${x}_${y}`) === "locked" &&
                adv.template !== "rogue" &&
                (adv.keys ?? 0) === 0;
              return (
                isLockedDoor ||
                (mobPlayerOccupied.has(`${x}_${y}`) &&
                  !(x === combatTarget!.x && y === combatTarget!.z))
              );
            },
            fourDir: true,
          },
        );
        if (combatAstar && combatAstar.path.length > 1) {
          const step = combatAstar.path[1];
          const debugPath = combatAstar.path
            .slice(2)
            .map((p: any) => ({ x: p.x, z: p.y }));
          return {
            adv,
            intendedX: step.x,
            intendedZ: step.y,
            debugPath,
            isAttack: false,
            inCombat: true,
          };
        }
        return {
          adv,
          intendedX: adv.x,
          intendedZ: adv.z,
          debugPath: [],
          isAttack: false,
          inCombat: true,
        };
      }

      // No combat target: use state machine
      const advState = adv.state ?? "exploring";

      if (advState === "exploring") {
        // Compute current room temperature
        const regionId = regionIdData[adv.z * dungeonWidth + adv.x];
        const baseTemp = temperatureData[adv.z * dungeonWidth + adv.x] ?? 127;
        const rise = roomTempRiseRef.current.get(regionId) ?? 0;
        const roomTemp = Math.min(255, baseTemp + Math.round(rise));

        // Update dread
        let newDread = adv.dread ?? 0;
        if (roomTemp <= 127) {
          newDread = newDread + adventurerDreadRateRef.current;
        } else {
          newDread = Math.max(
            0,
            newDread - adventurerDreadRateRef.current * 0.5,
          );
        }

        // Check chest pickup
        let newLoot = adv.loot ?? 0;
        const chestIdx = newChests.findIndex(
          (c) => c.x === adv.x && c.z === adv.z,
        );
        if (chestIdx !== -1) {
          const pickedChest = newChests[chestIdx];
          newChests.splice(chestIdx, 1);
          if (pickedChest.mimic) {
            adv = { ...adv, alive: false, hp: 0 };
            stepMessage = `The ${adv.name} opened a mimic chest and was devoured!`;
            return {
              adv,
              intendedX: adv.x,
              intendedZ: adv.z,
              debugPath: [],
              isAttack: false,
              inCombat: false,
            };
          }
          newLoot += adventurerLootPerChestRef.current;
          if (pickedChest.ecsData) {
            const keyCount = getChestKeyCount(
              pickedChest.ecsData.registry,
              pickedChest.ecsData.chestEntity,
            );
            if (keyCount > 0) {
              adv = { ...adv, keys: (adv.keys ?? 0) + keyCount };
            }
          }
        }

        // Check state transition
        const NO_LOOT_TURNS_LIMIT = 10;
        let newAdvState = "exploring";
        if (
          (newDread >= (adv.dreadThreshold ?? 15) &&
            newLoot >= (adv.lootThreshold ?? 20)) ||
          (adv.noLootTurns ?? 0) >= NO_LOOT_TURNS_LIMIT
        ) {
          newAdvState = "seeking";
          pendingSpeechBubbles.push({
            entityId: adv.id,
            text: ADVENTURER_SEEKING_DIALOG[
              Math.floor(Math.random() * ADVENTURER_SEEKING_DIALOG.length)
            ],
          });
        }

        if (newAdvState === "exploring") {
          // Pathfind to nearest chest
          let chestTarget: { x: number; z: number } | null = null;
          let chestDist = Infinity;
          for (const chest of newChests) {
            const d = Math.hypot(adv.x - chest.x, adv.z - chest.z);
            if (d < chestDist) {
              chestDist = d;
              chestTarget = { x: chest.x, z: chest.z };
            }
          }

          if (chestTarget) {
            const chestAstar = aStar8(
              { width: dungeonWidth, height: dungeonHeight },
              (x: number, y: number) => isWalkable(x, y),
              { x: adv.x, y: adv.z },
              { x: chestTarget.x, y: chestTarget.z },
              {
                isBlocked: (x: number, y: number) => {
                  const isLockedDoor =
                    doorStatesRef.current.get(`${x}_${y}`) === "locked" &&
                    adv.template !== "rogue" &&
                    (adv.keys ?? 0) === 0;
                  return isLockedDoor || mobPlayerOccupied.has(`${x}_${y}`);
                },
                fourDir: true,
              },
            );
            if (chestAstar && chestAstar.path.length > 1) {
              const step = chestAstar.path[1];
              const debugPath = chestAstar.path
                .slice(2)
                .map((p: any) => ({ x: p.x, z: p.y }));
              adv = {
                ...adv,
                dread: newDread,
                loot: newLoot,
                state: newAdvState,
                noLootTurns: 0,
              };
              return {
                adv,
                intendedX: step.x,
                intendedZ: step.y,
                debugPath,
                isAttack: false,
                inCombat: false,
              };
            }
            // Chest unreachable (locked door, no key) — wander to find accessible loot
          }

          // No reachable chests — count the stuck turn and wander
          const newNoLootTurns = (adv.noLootTurns ?? 0) + 1;
          const nonEndRoomsArray = [...dungeon.rooms.entries()].filter(
            ([id]: any) => id !== dungeon.endRoomId,
          );
          if (nonEndRoomsArray.length > 0) {
            const roomPickIdx =
              (adv.id.charCodeAt(4) ?? 0) % nonEndRoomsArray.length;
            const [, wanderRoom] = nonEndRoomsArray[roomPickIdx] as [any, any];
            const wx = wanderRoom.rect.x + Math.floor(wanderRoom.rect.w / 2);
            const wz = wanderRoom.rect.y + Math.floor(wanderRoom.rect.h / 2);
            const wanderAstar = aStar8(
              { width: dungeonWidth, height: dungeonHeight },
              (x: number, y: number) => isWalkable(x, y),
              { x: adv.x, y: adv.z },
              { x: wx, y: wz },
              {
                isBlocked: (x: number, y: number) => {
                  const isLockedDoor =
                    doorStatesRef.current.get(`${x}_${y}`) === "locked" &&
                    adv.template !== "rogue" &&
                    (adv.keys ?? 0) === 0;
                  return isLockedDoor || mobPlayerOccupied.has(`${x}_${y}`);
                },
                fourDir: true,
              },
            );
            if (wanderAstar && wanderAstar.path.length > 1) {
              const step = wanderAstar.path[1];
              const debugPath = wanderAstar.path
                .slice(2)
                .map((p: any) => ({ x: p.x, z: p.y }));
              adv = {
                ...adv,
                dread: newDread,
                loot: newLoot,
                state: newAdvState,
                noLootTurns: newNoLootTurns,
              };
              return {
                adv,
                intendedX: step.x,
                intendedZ: step.y,
                debugPath,
                isAttack: false,
                inCombat: false,
              };
            }
          }
          adv = {
            ...adv,
            dread: newDread,
            loot: newLoot,
            state: newAdvState,
            noLootTurns: newNoLootTurns,
          };
          return {
            adv,
            intendedX: adv.x,
            intendedZ: adv.z,
            debugPath: [],
            isAttack: false,
            inCombat: false,
          };
        }

        // State just switched to seeking — fall through to seeking logic below
        adv = { ...adv, dread: newDread, loot: newLoot, state: "seeking" };
        stepMessage = `The ${adv.name} is heading for the stove!`;
      }

      // seeking state: pathfind to nearest stove
      let stoveTarget: { x: number; z: number } | null = null;
      let stoveDist = Infinity;
      for (const stove of stovePlacements) {
        const d = Math.hypot(adv.x - stove.x, adv.z - stove.z);
        if (d < stoveDist) {
          stoveDist = d;
          stoveTarget = { x: stove.x, z: stove.z };
        }
      }

      if (!stoveTarget)
        return {
          adv,
          intendedX: adv.x,
          intendedZ: adv.z,
          debugPath: [],
          isAttack: false,
          inCombat: false,
        };

      const stoveAstar = aStar8(
        { width: dungeonWidth, height: dungeonHeight },
        (x: number, y: number) => isWalkable(x, y),
        { x: adv.x, y: adv.z },
        { x: stoveTarget.x, y: stoveTarget.z },
        {
          isBlocked: (x: number, y: number) => {
            const isLockedDoor =
              doorStatesRef.current.get(`${x}_${y}`) === "locked" &&
              adv.template !== "rogue" &&
              (adv.keys ?? 0) === 0;
            return isLockedDoor || mobPlayerOccupied.has(`${x}_${y}`);
          },
          fourDir: true,
        },
      );
      if (stoveAstar && stoveAstar.path.length > 1) {
        const step = stoveAstar.path[1];
        const debugPath = stoveAstar.path
          .slice(2)
          .map((p: any) => ({ x: p.x, z: p.y }));
        return {
          adv,
          intendedX: step.x,
          intendedZ: step.y,
          debugPath,
          isAttack: false,
          inCombat: false,
        };
      }
      return {
        adv,
        intendedX: adv.x,
        intendedZ: adv.z,
        debugPath: [],
        isAttack: false,
        inCombat: false,
      };
    });

    const anyInCombat = intendedMoves.some((m) => m.inCombat);
    console.log("[onStep] Phase 1 done, anyInCombat:", anyInCombat);

    if (anyInCombat) {
      // Phase 2 — detect swap pairs
      const swapSet = new Set<number>(); // indices of adventurers in a direct swap
      for (let i = 0; i < intendedMoves.length; i++) {
        const mi = intendedMoves[i];
        if (!mi.adv.alive || mi.isAttack) continue;
        if (mi.intendedX === mi.adv.x && mi.intendedZ === mi.adv.z) continue;
        for (let j = i + 1; j < intendedMoves.length; j++) {
          const mj = intendedMoves[j];
          if (!mj.adv.alive || mj.isAttack) continue;
          if (
            mi.intendedX === mj.adv.x &&
            mi.intendedZ === mj.adv.z &&
            mj.intendedX === mi.adv.x &&
            mj.intendedZ === mi.adv.z
          ) {
            swapSet.add(i);
            swapSet.add(j);
          }
        }
      }

      // Phase 3 — resolve final positions with collision
      const committed = new Set(mobPlayerOccupied);
      // Pre-commit swap destinations (guaranteed to execute)
      for (const idx of swapSet) {
        committed.add(
          `${intendedMoves[idx].intendedX}_${intendedMoves[idx].intendedZ}`,
        );
      }
      // Pre-commit positions of stationary adventurers (attacking, dead, or no path)
      for (let i = 0; i < intendedMoves.length; i++) {
        if (swapSet.has(i)) continue;
        const { adv, intendedX, intendedZ, isAttack } = intendedMoves[i];
        if (
          !adv.alive ||
          isAttack ||
          (intendedX === adv.x && intendedZ === adv.z)
        ) {
          committed.add(`${adv.x}_${adv.z}`);
        }
      }

      newAdventurers = intendedMoves.map((move, i) => {
        const { adv, intendedX, intendedZ, debugPath, isAttack } = move;
        if (!adv.alive) return adv;

        // Stationary (attack or no path)
        if (isAttack || (intendedX === adv.x && intendedZ === adv.z)) {
          return { ...adv, debugPath: [] };
        }

        // Swap pair — guaranteed move
        if (swapSet.has(i)) {
          return { ...adv, x: intendedX, z: intendedZ, debugPath };
        }

        // Non-swap mover — greedy claim
        const targetKey = `${intendedX}_${intendedZ}`;
        if (!committed.has(targetKey)) {
          committed.add(targetKey);
          return { ...adv, x: intendedX, z: intendedZ, debugPath };
        }
        // Blocked — stay
        return { ...adv, debugPath: [] };
      });
    } else {
      // No monsters in LOS — adventurers pass through each other freely.
      // Only player and mob positions are respected as hard blocks.
      newAdventurers = intendedMoves.map((move) => {
        const { adv, intendedX, intendedZ, debugPath, isAttack } = move;
        if (!adv.alive) return adv;
        if (isAttack || (intendedX === adv.x && intendedZ === adv.z)) {
          return { ...adv, debugPath: [] };
        }
        if (mobPlayerOccupied.has(`${intendedX}_${intendedZ}`)) {
          return { ...adv, debugPath: [] };
        }
        return { ...adv, x: intendedX, z: intendedZ, debugPath };
      });
    }

    // --- Adventurers open doors they've stepped onto ---
    {
      const doorUpdates = new Map(doorStatesRef.current);
      let anyDoorChanged = false;
      for (const adv of newAdventurers) {
        if (!adv.alive) continue;
        const key = `${adv.x}_${adv.z}`;
        const state = doorUpdates.get(key);
        if (state === undefined) continue;
        if (
          state === "locked" &&
          (adv.template === "rogue" || (adv.keys ?? 0) > 0)
        ) {
          doorUpdates.set(key, "open");
          anyDoorChanged = true;
          if (adv.template !== "rogue" && (adv.keys ?? 0) > 0) {
            adv.keys = (adv.keys ?? 0) - 1;
          }
        } else if (state !== "locked" && state !== "open") {
          doorUpdates.set(key, "open");
          anyDoorChanged = true;
        }
      }
      if (anyDoorChanged) setDoorStates(doorUpdates);
    }

    // --- Adventurers pick up loot they've walked onto ---
    for (const adv of newAdventurers) {
      if (!adv.alive) continue;
      const lootIdx = newIngredientDrops.findIndex(
        (d) => d.x === adv.x && d.z === adv.z,
      );
      if (lootIdx !== -1) {
        const loot = newIngredientDrops.splice(lootIdx, 1)[0];
        stepMessage = `The ${adv.name} snatched the ${loot.name}!`;
      }
    }

    // --- Spike trap triggering (adventurers only) ---
    for (let i = 0; i < newAdventurers.length; i++) {
      const adv = newAdventurers[i];
      if (!adv.alive) continue;
      const trapIdx = adv.z * dungeonWidth + adv.x;
      const key = `${adv.x}_${adv.z}`;
      if (hazardData[trapIdx] !== 1 || disarmedTrapsRef.current.has(key))
        continue;

      // Armed trap — trigger it
      const newDisarmed = new Set(disarmedTrapsRef.current);
      newDisarmed.add(key);
      disarmedTrapsRef.current = newDisarmed;

      const newHp = adv.hp - SPIKE_TRAP_DAMAGE;
      advHitEvents.push({
        advId: adv.id,
        damage: SPIKE_TRAP_DAMAGE,
        x: adv.x,
        z: adv.z,
      });
      if (newHp <= 0) {
        newAdventurers[i] = { ...adv, alive: false, hp: 0 };
        const dreadFactor =
          (adv.dreadThreshold ?? 0) > 0
            ? Math.min(1, (adv.dread ?? 0) / adv.dreadThreshold)
            : 0;
        const lootFactor =
          (adv.lootThreshold ?? 0) > 0
            ? Math.min(1, (adv.loot ?? 0) / adv.lootThreshold)
            : 0;
        const xpReward = Math.round(adv.xp * (1 + dreadFactor + lootFactor));
        newXpDrops.push({
          id: `xp_trap_${Date.now()}_${i}`,
          x: adv.x,
          z: adv.z,
          amount: xpReward,
        });
        const tmpl = ADVENTURER_TYPES.find((t) => t.type === adv.template);
        if (tmpl?.drop) {
          newIngredientDrops.push({
            id: tmpl.drop.id,
            name: tmpl.drop.name,
            x: adv.x,
            z: adv.z,
            dropKey: `ing_trap_${Date.now()}_${i}`,
          });
        }
        stepMessage = `The ${adv.name} was slain by a spike trap! (+${xpReward} gold)`;
      } else {
        newAdventurers[i] = { ...adv, hp: newHp };
        stepMessage = `A spike trap strikes the ${adv.name}!`;
      }
    }

    // --- Conscious mob AI: move toward nearest adventurer in line of sight ---
    console.log("[onStep] mob AI start");
    for (let i = 0; i < initialMobs.length; i++) {
      if (newMobSatiations[i] <= 0) continue; // unconscious
      const pos = newMobPositions[i];

      // Summon: pathfind toward stored target position
      if (mobSummonSet.current.has(i)) {
        const target = mobSummonSet.current.get(i)!;
        const dist = Math.abs(pos.x - target.x) + Math.abs(pos.z - target.z);
        if (dist <= 1) {
          mobSummonSet.current.delete(i);
        } else {
          const summonAstar = aStar8(
            { width: dungeonWidth, height: dungeonHeight },
            (x: number, y: number) => isWalkableForLos(x, y),
            { x: pos.x, y: pos.z },
            { x: target.x, y: target.z },
            { fourDir: true },
          );
          if (summonAstar && summonAstar.path.length > 1) {
            const step = summonAstar.path[1];
            const blockedByMob = newMobPositions.some(
              (p: any, j: number) =>
                j !== i && p.x === step.x && p.z === step.y,
            );
            const blockedByPlayer = step.x === pgx && step.y === pgz;
            if (!blockedByMob && !blockedByPlayer) {
              newMobPositions[i] = { x: step.x, z: step.y };
            }
          }
        }
        continue;
      }

      // Find nearest visible adventurer within LOS_RADIUS
      let chaseTarget: any = null;
      let chaseDist = Infinity;
      for (const adv of newAdventurers) {
        if (!adv.alive) continue;
        const d = Math.hypot(pos.x - adv.x, pos.z - adv.z);
        if (
          d < chaseDist &&
          d <= LOS_RADIUS &&
          hasLineOfSight(pos.x, pos.z, adv.x, adv.z, isWalkableForLos)
        ) {
          chaseDist = d;
          chaseTarget = adv;
        }
      }

      if (!chaseTarget) continue;
      // Already adjacent — counterattack section handles damage
      if (
        Math.abs(pos.x - chaseTarget.x) + Math.abs(pos.z - chaseTarget.z) ===
        1
      )
        continue;

      // Pathfind one step toward the adventurer
      const mobAstar = aStar8(
        { width: dungeonWidth, height: dungeonHeight },
        (x: number, y: number) => isWalkableForLos(x, y),
        { x: pos.x, y: pos.z },
        { x: chaseTarget.x, y: chaseTarget.z },
        { fourDir: true },
      );
      if (mobAstar && mobAstar.path.length > 1) {
        const step = mobAstar.path[1];
        // Don't step onto another mob's cell
        const blockedByMob = newMobPositions.some(
          (p: any, j: number) => j !== i && p.x === step.x && p.z === step.y,
        );
        const blockedByAdventurer = newAdventurers.some(
          (a) => a.alive && a.x === step.x && a.z === step.y,
        );
        if (!blockedByMob && !blockedByAdventurer) {
          newMobPositions[i] = { x: step.x, z: step.y };
        }
      }
    }

    // --- Conscious mob counterattack ---
    for (let i = 0; i < initialMobs.length; i++) {
      if (newMobSatiations[i] <= 0) continue; // unconscious
      const mob = initialMobs[i];
      const mobPos = newMobPositions[i];
      for (let j = 0; j < newAdventurers.length; j++) {
        const adv = newAdventurers[j];
        if (!adv.alive) continue;
        if (Math.abs(adv.x - mobPos.x) + Math.abs(adv.z - mobPos.z) === 1) {
          const damage = Math.max(1, mob.attack - adv.defense);
          const newHp = adv.hp - damage;
          mobAttackEventsLocal.push({
            mobIdx: i,
            dx: adv.x - mobPos.x,
            dz: adv.z - mobPos.z,
          });
          advHitEvents.push({ advId: adv.id, damage, x: adv.x, z: adv.z });
          if (newHp <= 0) {
            newAdventurers[j] = { ...adv, alive: false, hp: 0 };
            const dreadFactor =
              (adv.dreadThreshold ?? 0) > 0
                ? Math.min(1, (adv.dread ?? 0) / adv.dreadThreshold)
                : 0;
            const lootFactor =
              (adv.lootThreshold ?? 0) > 0
                ? Math.min(1, (adv.loot ?? 0) / adv.lootThreshold)
                : 0;
            const xpReward = Math.round(
              adv.xp * (1 + dreadFactor + lootFactor),
            );
            newXpDrops.push({
              id: `xp_${Date.now()}_${j}`,
              x: adv.x,
              z: adv.z,
              amount: xpReward,
            });
            // Drop ingredient based on adventurer type
            const tmpl = ADVENTURER_TYPES.find((t) => t.type === adv.template);
            if (tmpl?.drop) {
              newIngredientDrops.push({
                id: tmpl.drop.id,
                name: tmpl.drop.name,
                x: adv.x,
                z: adv.z,
                dropKey: `ing_${Date.now()}_${j}`,
              });
            }
            stepMessage = `${mob.name} slew the ${adv.name}! (+${xpReward} gold, ${tmpl?.drop?.name ?? "?"} dropped)`;
          } else {
            newAdventurers[j] = { ...adv, hp: newHp };
          }
          break; // each mob attacks at most one adventurer per step
        }
      }
    }

    // --- Tea station game-over: any adventurer on a stove tile ---
    const stoveSet = new Set(stovePlacements.map((s) => `${s.x}_${s.z}`));
    for (const adv of newAdventurers) {
      if (!adv.alive) continue;
      if (stoveSet.has(`${adv.x}_${adv.z}`)) {
        setGameState("gameover");
        setGameOverReason(`The ${adv.name} smashed your tea station!`);
        return;
      }
    }

    // --- Player HP game-over ---
    if (newPlayerHp <= 0) {
      setGameState("gameover");
      setGameOverReason("You have been defeated by the adventurers!");
      return;
    }

    // --- Win condition ---
    if (newRound >= winRounds) {
      setGameState("won");
      return;
    }

    // --- Commit all ref + state updates ---
    console.log("[onStep] committing state updates");
    adventurersRef.current = newAdventurers;
    currentRoundRef.current = newRound;
    playerXpRef.current = newPlayerXp;
    xpDropsRef.current = newXpDrops;
    playerHpRef.current = newPlayerHp;
    ingredientsRef.current = newIngredients;
    ingredientDropsRef.current = newIngredientDrops;
    chestsRef.current = newChests;
    mobSatiationsRef.current = newMobSatiations;
    mobHpsRef.current = newMobHps;
    mobRpsEffectsRef.current = newMobRpsEffects;
    mobPositionsRef.current = newMobPositions;
    setDisarmedTraps(new Set(disarmedTrapsRef.current));

    setTurnCount(newTurnCount);
    setRoundCountdown(newRoundCountdown);
    setCurrentRound(newRound);
    setAdventurers([...newAdventurers]);
    setPlayerXp(newPlayerXp);
    setXpDrops([...newXpDrops]);
    setPlayerHp(newPlayerHp);
    setIngredients(newIngredients);
    setIngredientDrops([...newIngredientDrops]);
    setChests([...newChests]);
    setMobSatiations(newMobSatiations);
    setMobHps(newMobHps);
    setMobRpsEffects([...newMobRpsEffects]);
    setMobPositions([...newMobPositions]);

    // --- Combat animation events ---
    {
      const FLASH_MS = 500;
      const ATTACK_MS = 450;
      const NUM_MS = 1600;

      // Mob damage flash
      if (mobHitEvents.length > 0) {
        const newFlash = mobDamageFlashRef.current.slice();
        mobHitEvents.forEach((e) => {
          newFlash[e.mobIdx] = true;
        });
        mobDamageFlashRef.current = newFlash;
        setMobDamageFlash([...newFlash]);
        mobHitEvents.forEach((e) =>
          setTimeout(() => {
            const arr = mobDamageFlashRef.current.slice();
            arr[e.mobIdx] = false;
            mobDamageFlashRef.current = arr;
            setMobDamageFlash([...arr]);
          }, FLASH_MS),
        );
      }

      // Adventurer damage flash
      if (advHitEvents.length > 0) {
        const aliveAdvs = newAdventurers.filter((a) => a.alive);
        const newAdvFlash = aliveAdvs.map((a) =>
          advHitEvents.some((e) => e.advId === a.id),
        );
        setAdvDamageFlash(newAdvFlash);
        if (newAdvFlash.some(Boolean))
          setTimeout(() => setAdvDamageFlash([]), FLASH_MS);
      }

      // Mob attack lunge dirs
      if (mobAttackEventsLocal.length > 0) {
        const newMobDirs: Array<{ dx: number; dz: number } | null> =
          initialMobs.map((_, idx) => {
            const e = mobAttackEventsLocal.find((ev) => ev.mobIdx === idx);
            return e ? { dx: e.dx, dz: e.dz } : null;
          });
        setMobAttackDirs(newMobDirs);
        setTimeout(
          () => setMobAttackDirs(initialMobs.map(() => null)),
          ATTACK_MS,
        );
      }

      // Adventurer attack lunge dirs
      if (advAttackEvents.length > 0) {
        const aliveAdvs = newAdventurers.filter((a) => a.alive);
        const newAdvDirs: Array<{ dx: number; dz: number } | null> =
          aliveAdvs.map((a) => {
            const e = advAttackEvents.find((ev) => ev.advId === a.id);
            return e ? { dx: e.dx, dz: e.dz } : null;
          });
        setAdvAttackDirs(newAdvDirs);
        setTimeout(() => setAdvAttackDirs([]), ATTACK_MS);
      }

      // Floating damage numbers
      const now = Date.now();
      const allNums: DamageNumberData[] = [
        ...mobHitEvents.map((e, ei) => ({
          id: `dmg_m${e.mobIdx}_${now}_${ei}`,
          x: e.x,
          z: e.z,
          amount: e.damage,
          spawnedAt: now,
        })),
        ...advHitEvents.map((e, ei) => ({
          id: `dmg_a${e.advId}_${now}_${ei}`,
          x: e.x,
          z: e.z,
          amount: e.damage,
          spawnedAt: now,
        })),
      ];
      if (allNums.length > 0) {
        setDamageNumbers((prev) => [...prev, ...allNums]);
        allNums.forEach((n) =>
          setTimeout(
            () => setDamageNumbers((prev) => prev.filter((x) => x.id !== n.id)),
            NUM_MS,
          ),
        );
      }
    }

    // --- Room heating from cozy objects (stoves) + temperature flow between rooms ---
    const cozyByRegion = new Map<number, number>();
    for (const s of stovePlacements) {
      if (s.type !== "stove") continue;
      const regionId = regionIdData[s.z * dungeonWidth + s.x];
      cozyByRegion.set(regionId, (cozyByRegion.get(regionId) ?? 0) + 1);
    }
    setRoomTempRise((prev) => {
      const next = new Map(prev);

      // Apply heating from cozy objects
      for (const [regionId, count] of cozyByRegion) {
        next.set(
          regionId,
          Math.min(128, (next.get(regionId) ?? 0) + count * heatingPerStep),
        );
      }

      // Flow temperature between adjacent region pairs (each pair processed once)
      for (const [a, b] of regionAdjacency) {
        const riseA = next.get(a) ?? 0;
        const riseB = next.get(b) ?? 0;
        if (riseA === riseB) continue;
        const flow = (riseA - riseB) * 0.1;
        next.set(a, riseA - flow);
        next.set(b, riseB + flow);
      }

      return next;
    });

    console.log("[onStep] done, turn:", newTurnCount);
    if (stepMessage) showMsg(stepMessage);

    // Don't emit new auto speech bubbles if any active bubble entity is already within
    // visible range of the player — prevents bubble spam when multiple NPCs are nearby.
    const activeBubbleIds = Object.keys(speechBubblesRef.current);
    const hasNearbyActiveBubble = activeBubbleIds.some((id) => {
      if (id.startsWith("mob_")) {
        const idx = parseInt(id.slice(4), 10);
        const pos = newMobPositions[idx];
        return pos
          ? Math.hypot(pos.x - pgx, pos.z - pgz) <= GHOST_SIGHT_RADIUS
          : false;
      }
      const adv = newAdventurers.find((a) => a.id === id && a.alive);
      return adv
        ? Math.hypot(adv.x - pgx, adv.z - pgz) <= GHOST_SIGHT_RADIUS
        : false;
    });
    if (!hasNearbyActiveBubble) {
      for (const { entityId, text } of pendingSpeechBubbles) {
        showSpeechBubble(entityId, text, 6000);
      }
    }
  }, [
    gameState,
    tempDropPerStep,
    heatingPerStep,
    satiationDropPerStep,
    solidData,
    regionIdData,
    regionAdjacency,
    dungeonWidth,
    dungeonHeight,
    turnsPerRound,
    temperatureData,
    dungeon,
    initialMobs,
    showMsg,
    showSpeechBubble,
    spawnAdventurersForRound,
    stovePlacements,
    doorPlacements,
    danceSatiationBoost,
  ]);

  const onTurn = useCallback(() => {
    if (gameState !== "playing") return;
    const { x, z } = logicalRef.current;
    const px = Math.floor(x);
    const pz = Math.floor(z);

    // Check for co-located mob
    const mobIdx = mobPositionsRef.current.findIndex(
      (p, i) => p.x === px && p.z === pz && (mobSatiationsRef.current?.[i] ?? 0) > 0,
    );
    if (mobIdx !== -1) {
      const ds = danceStateRef.current;
      if (ds.mobIdx === mobIdx) {
        danceStateRef.current = { ...ds, count: ds.count + 1 };
      } else {
        danceStateRef.current = { mobIdx, advId: null, count: 1 };
      }
      return;
    }

    // Check for co-located adventurer
    const adv = adventurersRef.current.find(
      (a) => a.alive && a.x === px && a.z === pz,
    );
    if (adv) {
      const ds = danceStateRef.current;
      if (ds.advId === adv.id) {
        danceStateRef.current = { ...ds, count: ds.count + 1 };
      } else {
        danceStateRef.current = { mobIdx: null, advId: adv.id, count: 1 };
      }
      return;
    }

    // Not co-located with anyone — reset
    danceStateRef.current = { mobIdx: null, advId: null, count: 0 };
  }, [gameState, mobPositionsRef, adventurersRef, mobSatiationsRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBlockedMove = useCallback((dx: number, dz: number) => {
    const passages = passagesRef.current;
    if (!passages.length) return;
    const { x, z } = logicalRef.current;
    const px = Math.floor(x);
    const pz = Math.floor(z);
    for (const p of passages) {
      if (!p.enabled) continue;
      const traversal = startPassageTraversal(p, { x: px, y: pz });
      if (!traversal || traversal.kind !== "active") continue;
      const first = traversal.remainingCells[0];
      if (first.x === px + dx && first.y === pz + dz) {
        traversalStartRef.current = {
          totalSteps: traversal.remainingCells.length,
          factor: traversalFactorRef.current,
        };
        setPassageTraversal(traversal);
        showMsg("Entering secret passage…");
        return;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // facingTarget depends on logicalRef (from camera) — it's computed in App.tsx
  // We expose a helper that App.tsx calls after getting logicalRef from useEotBCamera
  const getFacingTarget = useCallback(
    (logRef: { current: { x: number; z: number; yaw: number } }) => {
      const { x, z, yaw } = logRef.current;
      const gx = Math.floor(x);
      const gz = Math.floor(z);
      // Check if player is standing on a disarmed trap (interact to rearm)
      const playerKey = `${gx}_${gz}`;
      const playerTrapIdx = gz * dungeonWidth + gx;
      if (
        hazardData[playerTrapIdx] === 1 &&
        disarmedTrapsRef.current.has(playerKey)
      ) {
        return { type: "trap" as const, x: gx, z: gz };
      }
      const fdx = Math.round(-Math.sin(yaw));
      const fdz = Math.round(-Math.cos(yaw));
      const tx = gx + fdx;
      const tz = gz + fdz;
      const si = stovePlacements.findIndex((s) => s.x === tx && s.z === tz);
      if (si !== -1) {
        return {
          type: "stove" as const,
          stoveKey: `${stovePlacements[si].x}_${stovePlacements[si].z}`,
        };
      }
      const mi = mobPositions.findIndex((p) => p.x === tx && p.z === tz);
      if (mi !== -1) return { type: "mob" as const, mobIdx: mi };
      const doorKey = `${tx}_${tz}`;
      if (doorStatesRef.current.has(doorKey)) {
        return { type: "door" as const, doorKey };
      }
      return null;
    },
    [stovePlacements, mobPositions, hazardData, dungeonWidth],
  );

  // Passage traversal step-loop — needs doMove from camera; exposed via ref
  const doMoveRef = useRef<((dx: number, dz: number) => void) | null>(null);

  useEffect(() => {
    if (passageTraversal.kind !== "active") return;
    const { cell, next } = consumePassageStep(passageTraversal);
    setPassageTraversal(next);
    const { x, z } = logicalRef.current;
    doMoveRef.current?.(cell.x + 0.5 - x, cell.y + 0.5 - z);
    if (next.kind === "idle") {
      const { totalSteps, factor } = traversalStartRef.current;
      const turns = Math.round(totalSteps / factor);
      showMsg(
        `Secret passage traversed — ${totalSteps} step${totalSteps !== 1 ? "s" : ""} (${turns} turn${turns !== 1 ? "s" : ""} at ${factor}×).`,
      );
    }
  }, [passageTraversal]); // eslint-disable-line react-hooks/exhaustive-deps

  // togglePassage key — toggle passage at player position
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (passageTraversal.kind === "active") {
        setPassageTraversal(cancelPassageTraversal());
        return;
      }
      const passages = passagesRef.current;
      if (!passages.length || !passageMask) return;
      const { x, z } = logicalRef.current;
      const px = Math.floor(x);
      const pz = Math.floor(z);
      for (const p of passages) {
        if (
          (p.start.x === px && p.start.y === pz) ||
          (p.end.x === px && p.end.y === pz)
        ) {
          p.enabled = !p.enabled;
          const newMask = new Uint8Array(passageMask);
          if (p.enabled) {
            enablePassageInMask(newMask, dungeonWidth, p);
            showMsg("Passage unlocked!");
          } else {
            disablePassageInMask(newMask, dungeonWidth, p);
            showMsg("Passage locked.");
          }
          setPassageMask(newMask);
          sounds.twinkle.play();
          return;
        }
      }
      // showMsg("Nothing to interact with here.");
    };
    const keys = keybindings.togglePassage.join(",");
    if (keys) hotkeys(keys, handler as any);
    return () => {
      if (keys) hotkeys.unbind(keys, handler as any);
    };
  }, [passageTraversal, passageMask, dungeonWidth, showMsg, keybindings]); // eslint-disable-line react-hooks/exhaustive-deps

  // interact / recipe menu navigation — needs facingTarget from camera
  // We accept a facingTarget parameter via a ref so the useEffect can pick it up
  const facingTargetRef = useRef<any>(null);

  useEffect(() => {
    const facingTarget = facingTargetRef.current;

    function doInteract() {
      if (!facingTarget) return;
      if (gameState !== "playing") return;

      if (facingTarget.type === "stove") {
        const state = stoveStates.get(facingTarget.stoveKey);
        if (!state?.brewing) {
          setActiveStoveKey(facingTarget.stoveKey);
          setRecipeMenuCursor(0);
          setShowRecipeMenu(true);
        } else if (state.brewing.ready) {
          const recipe = state.brewing.recipe;
          const startTemp = recipe.idealTemperatureRange[1] + 15;
          const hand = !leftHandTea ? "left" : !rightHandTea ? "right" : null;
          if (!hand) {
            showMsg("Your hands are full!");
            return;
          }
          addTeaToHand(hand, recipe, startTemp);
          setStoveStates((prev) => {
            const next = new Map(prev);
            next.delete(facingTarget.stoveKey);
            return next;
          });
          showMsg(`Picked up ${recipe.name}!`);
        } else {
          showMsg(
            `Brewing ${state.brewing.recipe.name}... ${state.brewing.stepsRemaining} steps remaining.`,
          );
          sounds.denySelection.play();
        }
      } else if (facingTarget.type === "trap") {
        const key = `${facingTarget.x}_${facingTarget.z}`;
        const newDisarmed = new Set(disarmedTrapsRef.current);
        newDisarmed.delete(key);
        disarmedTrapsRef.current = newDisarmed;
        setDisarmedTraps(new Set(newDisarmed));
        showMsg("You reset the spike trap.");
        sounds.trap_armed.play();
      } else if (facingTarget.type === "mob") {
        const mob = initialMobs[facingTarget.mobIdx];
        const hand = leftHandTea ? "left" : rightHandTea ? "right" : null;
        const tea =
          hand === "left"
            ? leftHandTea
            : hand === "right"
              ? rightHandTea
              : null;
        const mobStatus = mobStatuses[facingTarget.mobIdx];
        const isUnconscious = mobSatiations[facingTarget.mobIdx] <= 0;
        const mobBubbleId = `mob_${facingTarget.mobIdx}`;
        if (tea && !isUnconscious && mobStatus === "ecstatic") {
          showSpeechBubble(
            mobBubbleId,
            "Oh, I couldn't possibly! I'm far too full right now — perhaps later.",
          );
          return;
        }
        if (!tea) {
          const preferredRecipe = RECIPES.find(
            (r) => r.id === mob.preferredRecipeId,
          );
          const status = mobStatuses[facingTarget.mobIdx];
          const thirstLine =
            status === "gasping"
              ? "I'm absolutely desperate for something to drink!"
              : status === "thirsty"
                ? "I'm quite parched."
                : status === "sated"
                  ? "I wouldn't mind some tea."
                  : status === "refreshed"
                    ? "I'm doing well, but tea is always welcome."
                    : "I'm fully satisfied, thank you.";
          showSpeechBubble(
            mobBubbleId,
            `I'd love some ${preferredRecipe?.name ?? "tea"}... ${thirstLine}`,
          );
          return;
        }
        const [lo] = tea.recipe.idealTemperatureRange;
        const [, hi] = tea.recipe.idealTemperatureRange;
        const handInventory = getHandInventory(hand!);
        const itemEntity = registry.useItem(handInventory);
        if (itemEntity) registry.removeEntity(itemEntity);
        setHandsVersion((v) => v + 1);
        if (!firstTeaDeliveredRef.current) {
          firstTeaDeliveredRef.current = true;
          showMsg(
            `Head back to the tea machine (stove) in the kitchen and press [${keybindings.interact[0] === " " ? "space" : keybindings.interact[0]}] to brew another tea!`,
          );
          setTimeout(() => {
            showMsg(
              "With empty hands you can pass through walls — explore the dungeon!",
            );
          }, 5500);
        }
        function applyMobSatiation(value: number) {
          const next = [...mobSatiationsRef.current!];
          next[facingTarget.mobIdx] = value;
          mobSatiationsRef.current = next;
          setMobSatiations(next);
        }

        applyMobSatiation(100);
        showSpeechBubble(
          mobBubbleId,
          `Ahh, thank you! This ${tea.name} is perfectly brewed — most refreshing!`,
        );
        sounds.twinkle.play();
      } else if (facingTarget.type === "door") {
        const state =
          doorStatesRef.current.get(facingTarget.doorKey) ?? "closed";
        if (state === "open") {
          setDoorStates((prev) =>
            new Map(prev).set(facingTarget.doorKey, "closed"),
          );
          sounds.slideDown.play();
          showMsg("You close the door.");
        } else if (state === "closed") {
          setDoorStates((prev) =>
            new Map(prev).set(facingTarget.doorKey, "locked"),
          );
          sounds.key_close.play();
          showMsg("You lock the door.");
        } else {
          setDoorStates((prev) =>
            new Map(prev).set(facingTarget.doorKey, "open"),
          );
          sounds.slideUp.play();
          showMsg("You unlock the door.");
        }
      }
    }

    const interactHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (showRecipeMenu) {
        setShowRecipeMenu(false);
        return;
      }
      if (showSummonMenu) {
        setShowSummonMenu(false);
        return;
      }
      doInteract();
    };
    const waitHandler = (e: KeyboardEvent) => {
      if (showRecipeMenu || showSummonMenu) return;
      e.preventDefault();
      onStep();
    };
    const discardLeftHandler = (e: KeyboardEvent) => {
      if (showRecipeMenu || showSummonMenu) return;
      e.preventDefault();
      if (gameState !== "playing") return;
      if (leftHandTea) {
        showMsg(`You discard your ${leftHandTea.name}.`);
        removeTeaFromHand("left");
        if (!firstTeaDeliveredRef.current) {
          firstTeaDeliveredRef.current = true;
          setTimeout(() => {
            showMsg(
              "With empty hands you can pass through walls — explore the dungeon!",
            );
          }, 1500);
        }
      } else {
        showMsg("Your left hand is empty.");
      }
    };
    const discardRightHandler = (e: KeyboardEvent) => {
      if (showRecipeMenu || showSummonMenu) return;
      e.preventDefault();
      if (gameState !== "playing") return;
      if (rightHandTea) {
        showMsg(`You discard your ${rightHandTea.name}.`);
        removeTeaFromHand("right");
        if (!firstTeaDeliveredRef.current) {
          firstTeaDeliveredRef.current = true;
          setTimeout(() => {
            showMsg(
              "With empty hands you can pass through walls — explore the dungeon!",
            );
          }, 1500);
        }
      } else {
        showMsg("Your right hand is empty.");
      }
    };
    const recipeCloseHandler = (e: KeyboardEvent) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      setShowRecipeMenu(false);
    };
    const recipeSelectHandler = (e: KeyboardEvent) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      const num = parseInt(e.key);
      if (num >= 1 && num <= RECIPES.length) {
        const recipe = RECIPES[num - 1];
        if (
          recipe.ingredientId &&
          (ingredients[recipe.ingredientId] ?? 0) < 1
        ) {
          showMsg(`You need ${recipe.ingredientName} to brew ${recipe.name}!`);
          return;
        }
        if (recipe.ingredientId) {
          const newIng = {
            ...ingredientsRef.current,
            [recipe.ingredientId]:
              ingredientsRef.current[recipe.ingredientId] - 1,
          };
          ingredientsRef.current = newIng;
          setIngredients(newIng);
        }
        setStoveStates((prev) => {
          const next = new Map(prev);
          next.set(activeStoveKey!, {
            brewing: {
              recipe,
              stepsRemaining: recipe.timeToBrew,
              ready: false,
            },
          });
          return next;
        });
        setShowRecipeMenu(false);
        showMsg(
          `Started brewing ${recipe.name}! ${recipe.timeToBrew} steps until ready.`,
        );
        sounds.acceptSelection.play();
      }
    };

    const recipeOptionNextHandler = (e: KeyboardEvent) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      sounds.selectionChanged.play();
      setRecipeMenuCursor((c) => (c + 1) % RECIPES.length);
    };
    const recipeOptionPrevHandler = (e: KeyboardEvent) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      sounds.selectionChanged.play();
      setRecipeMenuCursor((c) => (c - 1 + RECIPES.length) % RECIPES.length);
    };
    const recipeOptionSelectHandler = (e: KeyboardEvent) => {
      if (!showRecipeMenu) return;
      e.preventDefault();
      const recipe = RECIPES[recipeMenuCursor];
      if (!recipe) return;
      if (
        recipe.ingredientId &&
        (ingredientsRef.current[recipe.ingredientId] ?? 0) < 1
      ) {
        showMsg(`You need ${recipe.ingredientName} to brew ${recipe.name}!`);
        return;
      }
      if (recipe.ingredientId) {
        const newIng = {
          ...ingredientsRef.current,
          [recipe.ingredientId]:
            ingredientsRef.current[recipe.ingredientId] - 1,
        };
        ingredientsRef.current = newIng;
        setIngredients(newIng);
      }
      setStoveStates((prev) => {
        const next = new Map(prev);
        next.set(activeStoveKey!, {
          brewing: {
            recipe,
            stepsRemaining: recipe.timeToBrew,
            ready: false,
          },
        });
        return next;
      });
      setShowRecipeMenu(false);
      showMsg(
        `Started brewing ${recipe.name}! ${recipe.timeToBrew} steps until ready.`,
      );
      sounds.acceptSelection.play();
    };

    const summonOpenHandler = (e: KeyboardEvent) => {
      if (showRecipeMenu || showSummonMenu) return;
      if (gameState !== "playing") return;
      if (initialMobs.length === 0) return;
      e.preventDefault();
      setSummonMenuCursor(0);
      setShowSummonMenu(true);
    };
    const summonCloseHandler = (e: KeyboardEvent) => {
      if (!showSummonMenu) return;
      e.preventDefault();
      setShowSummonMenu(false);
    };
    const summonOptionNextHandler = (e: KeyboardEvent) => {
      if (!showSummonMenu) return;
      e.preventDefault();
      sounds.selectionChanged.play();
      setSummonMenuCursor((c) => (c + 1) % initialMobs.length);
    };
    const summonOptionPrevHandler = (e: KeyboardEvent) => {
      if (!showSummonMenu) return;
      e.preventDefault();
      sounds.selectionChanged.play();
      setSummonMenuCursor((c) => (c - 1 + initialMobs.length) % initialMobs.length);
    };
    const summonOptionSelectHandler = (e: KeyboardEvent) => {
      if (!showSummonMenu) return;
      e.preventDefault();
      const { x: px, z: pz } = logicalRef.current;
      const pgx = Math.floor(px);
      const pgz = Math.floor(pz);
      if (solidData[pgz * dungeonWidth + pgx] !== 0) {
        showMsg("Can't summon here — you're standing on a wall.");
        return;
      }
      if (mobPositionsRef.current.some((p: any) => p.x === pgx && p.z === pgz)) {
        showMsg("Can't summon here — a monster is already here.");
        return;
      }
      mobSummonSet.current.set(summonMenuCursor, { x: pgx, z: pgz });
      showMsg(`${initialMobs[summonMenuCursor].name} is on its way!`);
      setShowSummonMenu(false);
      sounds.acceptSelection.play();
    };
    const summonSelectHandler = (e: KeyboardEvent) => {
      if (!showSummonMenu) return;
      e.preventDefault();
      const num = parseInt(e.key);
      if (num >= 1 && num <= initialMobs.length) {
        const { x: px, z: pz } = logicalRef.current;
        const pgx = Math.floor(px);
        const pgz = Math.floor(pz);
        if (solidData[pgz * dungeonWidth + pgx] !== 0) {
          showMsg("Can't summon here — you're standing on a wall.");
          return;
        }
        if (mobPositionsRef.current.some((p: any) => p.x === pgx && p.z === pgz)) {
          showMsg("Can't summon here — a monster is already here.");
          return;
        }
        mobSummonSet.current.set(num - 1, { x: pgx, z: pgz });
        showMsg(`${initialMobs[num - 1].name} is on its way!`);
        setShowSummonMenu(false);
        sounds.acceptSelection.play();
      }
    };

    const interactKeys = keybindings.interact.join(",");
    const waitKeys = keybindings.wait.join(",");
    const discardLeftKeys = keybindings.discardLeft.join(",");
    const discardRightKeys = keybindings.discardRight.join(",");
    const optionNextKeys = (keybindings.optionNext ?? []).join(",");
    const optionPrevKeys = (keybindings.optionPrev ?? []).join(",");
    const optionSelectKeys = (keybindings.optionSelect ?? []).join(",");
    const summonKeys = (keybindings.summon ?? []).join(",");

    if (interactKeys) hotkeys(interactKeys, interactHandler as any);
    if (waitKeys) hotkeys(waitKeys, waitHandler as any);
    if (discardLeftKeys) hotkeys(discardLeftKeys, discardLeftHandler as any);
    if (discardRightKeys) hotkeys(discardRightKeys, discardRightHandler as any);
    if (optionNextKeys) hotkeys(optionNextKeys, recipeOptionNextHandler as any);
    if (optionNextKeys) hotkeys(optionNextKeys, summonOptionNextHandler as any);
    if (optionPrevKeys) hotkeys(optionPrevKeys, recipeOptionPrevHandler as any);
    if (optionPrevKeys) hotkeys(optionPrevKeys, summonOptionPrevHandler as any);
    if (optionSelectKeys)
      hotkeys(optionSelectKeys, recipeOptionSelectHandler as any);
    if (optionSelectKeys)
      hotkeys(optionSelectKeys, summonOptionSelectHandler as any);
    hotkeys("escape", recipeCloseHandler as any);
    hotkeys("escape", summonCloseHandler as any);
    hotkeys("1,2,3,4,5,6,7,8,9", recipeSelectHandler as any);
    hotkeys("1,2,3,4,5,6,7,8,9", summonSelectHandler as any);
    if (summonKeys) hotkeys(summonKeys, summonOpenHandler as any);

    return () => {
      if (interactKeys) hotkeys.unbind(interactKeys, interactHandler as any);
      if (waitKeys) hotkeys.unbind(waitKeys, waitHandler as any);
      if (discardLeftKeys)
        hotkeys.unbind(discardLeftKeys, discardLeftHandler as any);
      if (discardRightKeys)
        hotkeys.unbind(discardRightKeys, discardRightHandler as any);
      if (optionNextKeys)
        hotkeys.unbind(optionNextKeys, recipeOptionNextHandler as any);
      if (optionNextKeys)
        hotkeys.unbind(optionNextKeys, summonOptionNextHandler as any);
      if (optionPrevKeys)
        hotkeys.unbind(optionPrevKeys, recipeOptionPrevHandler as any);
      if (optionPrevKeys)
        hotkeys.unbind(optionPrevKeys, summonOptionPrevHandler as any);
      if (optionSelectKeys)
        hotkeys.unbind(optionSelectKeys, recipeOptionSelectHandler as any);
      if (optionSelectKeys)
        hotkeys.unbind(optionSelectKeys, summonOptionSelectHandler as any);
      hotkeys.unbind("escape", recipeCloseHandler as any);
      hotkeys.unbind("escape", summonCloseHandler as any);
      hotkeys.unbind("1,2,3,4,5,6,7,8,9", recipeSelectHandler as any);
      hotkeys.unbind("1,2,3,4,5,6,7,8,9", summonSelectHandler as any);
      if (summonKeys) hotkeys.unbind(summonKeys, summonOpenHandler as any);
    };
  }, [
    showRecipeMenu,
    showSummonMenu,
    stoveStates,
    leftHandTea,
    rightHandTea,
    initialMobs,
    mobStatuses,
    mobSatiations,
    activeStoveKey,
    showMsg,
    showSpeechBubble,
    onStep,
    supersatiationBonus,
    ingredients,
    gameState,
    keybindings,
    recipeMenuCursor,
    summonMenuCursor,
  ]);

  return {
    // atlas/texture
    atlas,
    texture,
    characterSpriteAtlas,
    iconTexture,
    objectRegistry,
    // game state — hand items via ECS
    leftHandTea,
    rightHandTea,
    clearHands,
    addTeaToHand,
    mobSatiations,
    setMobSatiations,
    mobHps,
    setMobHps,
    mobRpsEffects,
    setMobRpsEffects,
    mobPositions,
    setMobPositions,
    mobPositionsRef,
    mobStatuses,
    stoveStates,
    setStoveStates,
    showRecipeMenu,
    setShowRecipeMenu,
    recipeMenuCursor,
    setRecipeMenuCursor,
    activeStoveKey,
    setActiveStoveKey,
    showSummonMenu,
    setShowSummonMenu,
    summonMenuCursor,
    setSummonMenuCursor,
    message,
    displayedText,
    setMessage,
    showMsg,
    speechBubbles,
    showSpeechBubble,
    roomTempRise,
    setRoomTempRise,
    roomTempRiseRef,
    regionIdData,
    regionAdjacency,
    dynamicTempData,
    showSettings,
    setShowSettings,
    showTempTint,
    setShowTempTint,
    chests,
    setChests,
    chestsRef,
    adventurers,
    setAdventurers,
    adventurersRef,
    currentRound,
    setCurrentRound,
    currentRoundRef,
    turnCount,
    setTurnCount,
    turnCountRef,
    roundCountdown,
    setRoundCountdown,
    roundCountdownRef,
    playerXp,
    setPlayerXp,
    playerXpRef,
    xpDrops,
    setXpDrops,
    xpDropsRef,
    playerHp,
    setPlayerHp,
    playerHpRef,
    ingredients,
    setIngredients,
    ingredientsRef,
    ingredientDrops,
    setIngredientDrops,
    ingredientDropsRef,
    gameState,
    setGameState,
    gameOverReason,
    setGameOverReason,
    // refs
    adventurerSightingsRef,
    mobSatiationsRef,
    mobHpsRef,
    ruinedNotifiedRef,
    playerHandsRef, // { left: Tea|null, right: Tea|null } kept in sync with ECS
    exploredMaskRef,
    passagesRef,
    // passage state
    passageMask,
    setPassageMask,
    passageTraversal,
    passageTraversalRef,
    setPassageTraversal,
    traversalFactorRef,
    traversalStartRef,
    // callbacks
    onStep,
    onTurn,
    onBlockedMove,
    spawnAdventurersForRound,
    getFacingTarget,
    summonMob: (mobIdx: number, targetX: number, targetZ: number) => {
      mobSummonSet.current.set(mobIdx, { x: targetX, z: targetZ });
    },
    // refs for cross-hook wiring
    logicalRef,
    doMoveRef,
    facingTargetRef,
    // computed
    mobiles,
    activeSpeechBubbles,
    // combat animations
    mobDamageFlash,
    advDamageFlash,
    mobAttackDirs,
    advAttackDirs,
    damageNumbers,
    // trap state
    disarmedTraps,
    // door state
    doorStates,
  };
}
