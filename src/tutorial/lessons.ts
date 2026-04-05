import { MOB_ATTACK, MOB_DEFENSE } from "../gameConstants";
import type { HiddenPassage } from "../../roguelike-mazetools/src/content";

export const TUTORIAL_DUNGEON_W = 22;
export const TUTORIAL_DUNGEON_H = 20;

// Update these when the ice tea recipe is added
export const ICE_TEA_RECIPE_ID = "iced-tea";
export const ICE_TEA_INGREDIENT_ID = "frost-leaf";

export interface LessonRoom {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpecialCell {
  x: number;
  z: number;
  floor?: string; // atlas floor texture name override
  wall?: string; // atlas wall texture name override
}

export interface LessonConfig {
  dungeonW: number;
  dungeonH: number;
  rooms: LessonRoom[];
  startRoomId: number;
  endRoomId: number;
  passage?: HiddenPassage;
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  mobs: Array<{
    id: string;
    x: number;
    z: number;
    name: string;
    type: string;
    preferredRecipeId: string;
    attack: number;
    defense: number;
  }>;
  stovePlacements: Array<{ x: number; z: number; type: string }>;
  doorPlacements?: Array<{
    x: number;
    z: number;
    type: string;
    offsetX: number;
    offsetZ: number;
    offsetY: number;
    yaw: number;
    meta: { blockDx: number; blockDz: number };
  }>;
  hazardCells?: Array<{ x: number; z: number }>;
  initialDisarmedTraps?: string[];
  initialOpenDoors?: string[];
  specialCells?: SpecialCell[];
  wallTexture?: string;
  floorTexture?: string;
  startMessage: string;
}

const W = TUTORIAL_DUNGEON_W;
const H = TUTORIAL_DUNGEON_H;
const CEILING_H = 3;

// ── Lesson 0 ──────────────────────────────────────────────────────────────────
// Foyer (6×4) + preview room (8×4) separated by a 3-cell wall.
// Player walks through the wall as a ghost (no tea in hand) to reach Room B.
//
// Foyer:   x 2..7,  z 7..10
// Preview: x 11..18, z 7..10
// Wall:    x 8..10
// Passage: z=8 from (7,8)→(11,8)

const LESSON_0_PASSAGE: HiddenPassage = {
  id: 1,
  start: { x: 7, y: 8 },
  end: { x: 11, y: 8 },
  cells: [
    { x: 7, y: 8 },
    { x: 8, y: 8 },
    { x: 9, y: 8 },
    { x: 10, y: 8 },
    { x: 11, y: 8 },
  ],
  enabled: false,
};

// ── Lesson 1 ──────────────────────────────────────────────────────────────────
// Main room (12×5) with all tutorial content, plus a small secret room (3×5)
// reachable via a hidden passage through the east wall.
//
// Main room:    x 1..12,  z 6..10  (centre row z=8)
// Secret room:  x 17..19, z 6..10
// Wall between: x 13..16
// Passage:      z=8 from (12,8)→(17,8)
//
// Content (all on z=8, player faces east from spawn at x=2.5):
//   x=2  - tea machine (Teaomatic)
//   x=5  - unconscious monster (gasping/red, needs ice tea)
//   x=8  - harvestable ingredient drop ("plant")
//   x=10 - sprung trap (pre-disarmed)
//   x=11 - open door
//   x=12 - antechamber (one tile before east wall + passage button)

const LESSON_1_PASSAGE: HiddenPassage = {
  id: 1,
  start: { x: 12, y: 8 },
  end: { x: 17, y: 8 },
  cells: [
    { x: 12, y: 8 },
    { x: 13, y: 8 },
    { x: 14, y: 8 },
    { x: 15, y: 8 },
    { x: 16, y: 8 },
    { x: 17, y: 8 },
  ],
  enabled: false,
};

export const LESSON_CONFIGS: LessonConfig[] = [
  // ── Lesson 0 ── Ghost navigation / walk-through-walls intro ───────────────
  {
    dungeonW: W,
    dungeonH: H,
    rooms: [
      { x: 2, y: 7, w: 6, h: 4 }, // Foyer - player starts here
      { x: 11, y: 7, w: 8, h: 4 }, // Preview room - destination
    ],
    startRoomId: 1,
    endRoomId: 2,
    passage: LESSON_0_PASSAGE,
    spawnX: 4.5,
    spawnZ: 9.5,
    spawnYaw: -Math.PI / 2, // facing east
    mobs: [],
    stovePlacements: [],
    wallTexture: "Cobblestone",
    floorTexture: "fancyTile",
    specialCells: [
      // Staircase at the western end - player descended from above
      { x: 2, z: 8, floor: "staircaseDown" },
      { x: 2, z: 9, floor: "staircaseDown" },
    ],
    startMessage:
      "Do you have any idea how hard it is to find a job as a poltergeist?\n" +
      "But I was most fortunate to receive a request from the Earl of Grey.\n" +
      '"Refresh the dungeon", he said - cleaning and maintenance, I suppose.\n\n' +
      "The traps and residents of this dungeon won't harm you, and as a ghost you can walk through walls.\n" +
      "Use the minimap to orientate yourself and WASD to move, Q & E to rotate.\n" +
      "When you're ready, head through the wall and into the next room.",
  },

  // ── Lesson 1 ── The dungeon proper - all tutorial content ─────────────────
  {
    dungeonW: W,
    dungeonH: H,
    rooms: [
      { x: 1, y: 6, w: 12, h: 5 }, // Main room
      { x: 17, y: 6, w: 3, h: 5 }, // Secret passage destination
    ],
    startRoomId: 1,
    endRoomId: 2,
    passage: LESSON_1_PASSAGE,
    spawnX: 2.5,
    spawnZ: 8.5,
    spawnYaw: -Math.PI / 2, // facing east
    mobs: [
      {
        id: "mob_0",
        x: 5,
        z: 8,
        name: "Dungeon Guard",
        type: "goblin",
        preferredRecipeId: ICE_TEA_RECIPE_ID,
        attack: MOB_ATTACK,
        defense: MOB_DEFENSE,
      },
    ],
    stovePlacements: [{ x: 2, z: 8, type: "stove" }],
    doorPlacements: [
      {
        x: 11,
        z: 8,
        type: "door_cobble",
        offsetX: 0,
        offsetZ: 0,
        offsetY: CEILING_H / 2,
        yaw: 0, // door face runs north-south, blocks east-west movement
        meta: { blockDx: 1, blockDz: 0 },
      },
    ],
    hazardCells: [{ x: 10, z: 8 }],
    initialDisarmedTraps: ["10_8"], // trap is already sprung by a careless adventurer
    initialOpenDoors: ["11_8"], // door was left open
    wallTexture: "Cobblestone",
    floorTexture: "Flagstone",
    startMessage:
      "The Earl certainly has eccentric tastes, like this new-fangled tea machine..\n" +
      "Oh! Perhaps he meant to provide refreshments to the dungeon monsters?\n" +
      "I had better do both - just in case. I can't afford to lose this job.\n\n" +
      'Interact with the tea machine, monsters, or other items with "space".\n' +
      "You can always find the machine on the minimap, marked with an orange dot.\n" +
      "Start some tea brewing and explore the room while you wait for it.",
  },
];

// Ingredient drop placed in lesson 1 at (8,8) - the "plant" the player harvests.
// Uses "herbs" so picking it up unlocks Oolong Tea as well.
export const LESSON_1_PLANT_DROP = {
  id: "tut_plant",
  name: "Wild Herbs",
  x: 8,
  z: 8,
  dropKey: "tut_plant_0",
};
