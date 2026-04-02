import { RECIPES } from "../tea";
import { MOB_ATTACK, MOB_DEFENSE } from "../gameConstants";
import type { HiddenPassage } from "../../roguelike-mazetools/src/content";

export const TUTORIAL_DUNGEON_W = 22;
export const TUTORIAL_DUNGEON_H = 20;

export interface LessonRoom {
  x: number;
  y: number;
  w: number;
  h: number;
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
  startMessage: string;
}

const W = TUTORIAL_DUNGEON_W;
const H = TUTORIAL_DUNGEON_H;

// Lesson 1: Two 5x5 rooms separated by a 3-cell wall.
// Room A: cells (2,7)..(6,11), Room B: cells (10,7)..(14,11)
// Hidden passage at z=9 through wall cells (7,9),(8,9),(9,9)
const LESSON_1_PASSAGE: HiddenPassage = {
  id: 1,
  start: { x: 6, y: 9 },
  end: { x: 10, y: 9 },
  cells: [
    { x: 6, y: 9 },
    { x: 7, y: 9 },
    { x: 8, y: 9 },
    { x: 9, y: 9 },
    { x: 10, y: 9 },
  ],
  enabled: false,
};

export const LESSON_CONFIGS: LessonConfig[] = [
  // ── Lesson 1 ── Hidden passage exploration
  {
    dungeonW: W,
    dungeonH: H,
    rooms: [
      { x: 2, y: 7, w: 5, h: 5 }, // Room A — player starts here
      { x: 10, y: 7, w: 5, h: 5 }, // Room B — destination
    ],
    startRoomId: 1,
    endRoomId: 2,
    passage: LESSON_1_PASSAGE,
    // Spawn in center of Room A, facing east toward Room B
    spawnX: 4.5,
    spawnZ: 9.5,
    spawnYaw: -Math.PI / 2,
    mobs: [],
    stovePlacements: [],
    startMessage:
      "...Is this the afterlife? I'd kill for a cuppa right about now. — There must be a way through this wall.",
  },

  // ── Lesson 2 ── Teaomatic interaction
  {
    dungeonW: W,
    dungeonH: H,
    rooms: [{ x: 4, y: 4, w: 8, h: 8 }],
    startRoomId: 1,
    endRoomId: 1,
    // Spawn facing north toward the stove at (8,6)
    spawnX: 8.5,
    spawnZ: 7.5,
    spawnYaw: 0,
    mobs: [],
    stovePlacements: [{ x: 8, z: 6, type: "stove" }],
    startMessage:
      "A Teaomatic? Here? In the afterlife — in a dungeon of all places? How perfectly peculiar...",
  },

  // ── Lesson 3 ── Revive an unconscious traveller
  {
    dungeonW: W,
    dungeonH: H,
    rooms: [{ x: 4, y: 4, w: 8, h: 8 }],
    startRoomId: 1,
    endRoomId: 1,
    // Spawn facing north toward the mob at (8,6)
    spawnX: 8.5,
    spawnZ: 7.5,
    spawnYaw: 0,
    mobs: [
      {
        id: "mob_0",
        x: 8,
        z: 6,
        name: "Traveller",
        type: "goblin",
        preferredRecipeId: RECIPES[0].id, // prefers Green Tea
        attack: MOB_ATTACK,
        defense: MOB_DEFENSE,
      },
    ],
    stovePlacements: [],
    startMessage:
      "A poor soul, unconscious on the cold stone. I wonder if they'd like a cuppa...",
  },
];
