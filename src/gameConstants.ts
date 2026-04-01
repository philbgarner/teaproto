import { buildAtlasIndex } from "../roguelike-mazetools/src/atlas";
import atlasJson from "./assets/atlas.json";
import {
  buildTileAtlas,
  uvToTileId,
} from "../roguelike-mazetools/src/rendering/tileAtlas";

export const atlasIndex = buildAtlasIndex(atlasJson);

// ---------------------------------------------------------------------------
// Tile atlas
// ---------------------------------------------------------------------------
export const TILE_PX = 64;
export const ATLAS_SHEET_W = 512;
export const ATLAS_SHEET_H = 1024;
export const TILE_SIZE = 3;
export const CEILING_H = 3;

// Character sprite sheet dimensions (public/textures/characters.png)
export const CHAR_SHEET_W = 512;
export const CHAR_SHEET_H = 512;

// Default tile IDs derived from atlas.json entries (row-major in 512×1024 sheet)
export function _atlasUvToId(uv: [number, number]): number {
  return uvToTileId(uv[0], uv[1], TILE_PX, ATLAS_SHEET_W);
}

export const _defaultFloorEntry = atlasIndex.floorTypes.byName("Cobblestone");
export const _defaultWallEntry = atlasIndex.wallTypes.byName("Cobblestone");
export const _defaultCeilingEntry =
  atlasIndex.ceilingTypes.byName("Cobblestone");

export const TILE_FLOOR: number =
  _defaultFloorEntry && "uv" in _defaultFloorEntry
    ? _atlasUvToId(_defaultFloorEntry.uv as [number, number])
    : 0;
export const TILE_CEILING: number =
  _defaultCeilingEntry && "uv" in _defaultCeilingEntry
    ? _atlasUvToId(_defaultCeilingEntry.uv as [number, number])
    : TILE_FLOOR;
export const TILE_WALL: number =
  _defaultWallEntry && "uv" in _defaultWallEntry
    ? _atlasUvToId(_defaultWallEntry.uv as [number, number])
    : 0;

// Build maps: atlas type ID (1-based) → row-major tile ID in the full atlas sheet
export const FLOOR_TILE_MAP: number[] = (
  atlasIndex.data.floorTypes as any[]
).map((ft: any) =>
  "uv" in ft ? _atlasUvToId(ft.uv as [number, number]) : TILE_FLOOR,
);
export const WALL_TILE_MAP: number[] = (atlasIndex.data.wallTypes as any[]).map(
  (wt: any) =>
    "uv" in wt ? _atlasUvToId(wt.uv as [number, number]) : TILE_WALL,
);
export const CEILING_TILE_MAP: number[] = (
  atlasIndex.data.ceilingTypes as any[]
).map((ct: any) =>
  "uv" in ct ? _atlasUvToId(ct.uv as [number, number]) : TILE_CEILING,
);

export const ARCH_COBBLE_UV: [number, number] = (atlasIndex.architecture.byName(
  "archCobble",
)?.uv as [number, number]) ?? [64, 0];
export const ARCH_BRICK_UV: [number, number] = (atlasIndex.architecture.byName(
  "archBrick",
)?.uv as [number, number]) ?? [0, 64];
export const COBBLESTONE_WALL_ID: number =
  atlasIndex.wallTypes.idByName("Cobblestone");
export const PASSAGE_OVERLAY_IDS: number[] = [
  _atlasUvToId(
    (atlasIndex.wallOverlays.byName("buttonUnpressed")?.uv as [
      number,
      number,
    ]) ?? [256, 256],
  ),
  _atlasUvToId(
    (atlasIndex.wallOverlays.byName("buttonPressed")?.uv as [
      number,
      number,
    ]) ?? [192, 256],
  ),
  _atlasUvToId(
    (atlasIndex.wallOverlays.byName("openEmptyDoorDark")?.uv as [
      number,
      number,
    ]) ?? [192, 0],
  ),
];

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------
export const DIRS: string[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export const LOS_RADIUS = 8;

// ---------------------------------------------------------------------------
// Camera hook — grid-locked movement with lerp animation
// ---------------------------------------------------------------------------
export const LERP_DURATION_MS = 150;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const DUNGEON_SEED = 42;
export const DUNGEON_W = 32;
export const DUNGEON_H = DUNGEON_W;

export interface MobType {
  type: string;
  name: string;
  geometrySize: [number, number];
  uvRect: { x: number; y: number; w: number; h: number };
}

export const MOB_TYPES: MobType[] = [
  {
    type: "bat",
    name: "Bat",
    geometrySize: [2, 1],
    uvRect: { x: 0, y: 448, w: 128, h: 64 },
  },
  {
    type: "dragon",
    name: "Dragon",
    geometrySize: [2, 1],
    uvRect: { x: 384, y: 320, w: 128, h: 64 },
  },
  {
    type: "goblin",
    name: "Goblin",
    geometrySize: [1, 1],
    uvRect: { x: 0, y: 320, w: 64, h: 64 },
  },
  {
    type: "troll",
    name: "Troll",
    geometrySize: [1, 1],
    uvRect: { x: 0, y: 192, w: 64, h: 64 },
  },
  {
    type: "skeleton",
    name: "Skeleton",
    geometrySize: [1, 1],
    uvRect: { x: 0, y: 64, w: 64, h: 64 },
  },
];
export const MOB_TYPE_MAP: Record<string, MobType> = Object.fromEntries(
  MOB_TYPES.map((t) => [t.type, t]),
);
export const MOB_NAMES: string[] = MOB_TYPES.map((t) => t.name);

// Dialog pools for when an adventurer first spots the ghost (player)
export const GHOST_DIALOG: string[] = [
  "A ghost! Good heavens — I wasn't expecting that.",
  "Is that... a ghost?! By all the teapots in the realm!",
  "Oh! Oh my. There's definitely a ghost right there.",
  "W-wait. Is that a spectre? This dungeon is stranger than I thought.",
  "A ghost! I must be losing my mind... or the dungeon is haunted. Probably both.",
  "There's definitely a ghost in here. I'm choosing to remain calm about this.",
  "Hm. A ghost. Not what I planned for today, but here we are.",
  "So there's a ghost. Fine. I've seen stranger things in a dungeon.",
  "A ghost. Well... at least it's not another adventurer.",
  "I wonder if ghosts prefer tea. I should ask, if it doesn't kill me first.",
];
export const GHOST_DIALOG_WITH_TEA: string[] = [
  "A ghost! And — wait, why is my cup floating?! Oh. Oh no.",
  "Is that a ghost?! And it's... it appears to be drifting alongside my tea. Fascinating. Terrifying.",
  "A ghost! Good heavens — now there's a disembodied cup tumbling through the air alongside it.",
  "W-what?! A ghost AND a levitating cup of tea? This dungeon has gone completely mad.",
  "A ghost! By the kettle — my tea appears to be floating of its own accord now.",
  "There's a ghost, and my cup appears to be floating. I'm going to carry on.",
  "A ghost nearby... and a disembodied cup of tea hovering in the air. Perfectly normal dungeon.",
  "The ghost seems interested in the tea. Or maybe the cup is just haunted now. Hard to say.",
  "I suppose a floating cup of tea is less alarming than a ghost. Only slightly.",
  "My tea is levitating. There's a ghost. I am fine. Everything is fine.",
];
export const ADVENTURER_SEEKING_DIALOG: string[] = [
  "Enough plunder — now to find the heart of this place!",
  "Right, that'll do. Time to hunt down whatever keeps this pit warm.",
  "My pockets are full and my nerves are shot. The stove must be near!",
  "Loot? Check. Creeping dread? Absolutely. Let's finish this.",
  "Something cosy lurks deeper in. I can smell the tea from here.",
  "That's enough loot. Now — where is that infernal warmth coming from?",
];

export const GHOST_SIGHT_RADIUS = 8;

export const TURNS_PER_WAVE = 120;
export const WAVE_COUNTDOWN_THRESHOLD = 20;
export const PLAYER_MAX_HP = 30;
export const PLAYER_DEFENSE = 2;
export const MOB_ATTACK = 3;
export const MOB_DEFENSE = 1;
export const WIN_WAVES = 10;

export interface AdventurerType {
  type: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  xp: number;
  colorRgb: [number, number, number];
  drop: { id: string; name: string };
  geometrySize: [number, number];
  uvRect: { x: number; y: number; w: number; h: number };
}

// ingredientId matches RECIPES ingredientId
export const ADVENTURER_TYPES: AdventurerType[] = [
  {
    type: "warrior",
    name: "Warrior",
    hp: 20,
    attack: 5,
    defense: 2,
    xp: 30,
    colorRgb: [1.0, 0.15, 0.15],
    drop: { id: "rations", name: "Iron Rations" },
    geometrySize: [1, 1],
    uvRect: { x: 192, y: 64, w: 64, h: 64 },
  },
  {
    type: "rogue",
    name: "Rogue",
    hp: 12,
    attack: 7,
    defense: 1,
    xp: 25,
    colorRgb: [0.9, 0.1, 0.9],
    drop: { id: "herbs", name: "Wild Herbs" },
    geometrySize: [1, 1],
    uvRect: { x: 192, y: 0, w: 64, h: 64 },
  },
  {
    type: "mage",
    name: "Mage",
    hp: 10,
    attack: 9,
    defense: 0,
    xp: 40,
    colorRgb: [0.2, 0.3, 1.0],
    drop: { id: "dust", name: "Arcane Dust" },
    geometrySize: [2, 2],
    uvRect: { x: 192, y: 128, w: 128, h: 128 },
  },
];

/** Keyed by adventurer type string for O(1) lookup in the mobiles memo. */
export const ADVENTURER_TYPE_MAP: Record<string, AdventurerType> =
  Object.fromEntries(ADVENTURER_TYPES.map((t) => [t.type, t]));

export const STATUS_RGB: Record<string, [number, number, number]> = {
  ecstatic: [0.8, 0.2, 1.0],
  gasping: [1.0, 0.1, 0.1],
  thirsty: [1.0, 0.9, 0.0],
  sated: [0.0, 0.5, 1.0],
  refreshed: [0.2, 1.0, 0.3],
};
export const STATUS_CSS: Record<string, string> = {
  ecstatic: "#c3f",
  gasping: "#f22",
  thirsty: "#fe0",
  sated: "#08f",
  refreshed: "#3f5",
};

// ---------------------------------------------------------------------------
// Spike traps
// ---------------------------------------------------------------------------
/** Bit 0 of the hazard byte: cell contains a spike trap. */
export const SPIKE_HAZARD = 1;
/** Bit 1 of the hazard byte: spikes are currently extended/active. */
export const SPIKE_HAZARD_ACTIVE = 2;
/** Damage dealt when triggering a spike trap. */
export const SPIKE_DAMAGE = 5;
/** Tile ID for the trap-grid floor decoration overlay (atlas UV 256, 192). */
export const FLOOR_TRAP_OVERLAY_TILE_ID: number = _atlasUvToId([256, 192]);

// Re-export buildTileAtlas for use in useGameState
export { buildTileAtlas };

console.log("[App module] all top-level defs done");
