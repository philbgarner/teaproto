export type ThemeDef = {
  /** Name matching an entry in atlas.json `floorTypes`. */
  floorType: string;
  /** Name matching an entry in atlas.json `wallTypes`. */
  wallType: string;
  /** Name matching an entry in atlas.json `ceilingTypes`. */
  ceilingType: string;
};

export const THEMES: Record<string, ThemeDef> = {
  dungeon: {
    floorType: "Cobblestone",
    wallType: "Cobblestone",
    ceilingType: "Cobblestone",
  },
  crypt: {
    floorType: "Flagstone",
    wallType: "Concrete",
    ceilingType: "Flagstone",
  },
  catacomb: {
    floorType: "Cobblestone",
    wallType: "Plaster",
    ceilingType: "Concrete",
  },
  industrial: {
    floorType: "Steel",
    wallType: "Concrete",
    ceilingType: "Steel",
  },
  ruins: {
    floorType: "Dirt",
    wallType: "Cobblestone",
    ceilingType: "Cobblestone",
  },
};

export const THEME_KEYS = Object.keys(THEMES);
