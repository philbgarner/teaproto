# Monster Tea Party — Feature Reference

Prototype built for Dungeon Crawler Jam 2026. All values are current as of the source code in `src/`.

---

## Game Flow

1. Dungeon generated via BSP; player spawns at the centre of the end room.
2. Stoves placed in end room; ingredient drops scattered through the dungeon.
3. Friendly mobs placed one per non-end room.
4. Each turn (triggered by any move or the wait key):
   - Held tea cools; stove brew timers count down.
   - Mob satiation decreases.
   - Wave spawned if threshold reached.
   - Adventurer AI moves and attacks.
   - Mobs counterattack adjacent adventurers.
   - Player picks up XP and ingredient drops underfoot.
   - Win / game-over conditions checked.
5. Player interacts with stoves to brew and collect tea, then offers it to mobs.
6. **Win**: Survive 10 waves.
7. **Lose**: Player HP reaches 0, or any adventurer steps onto a stove tile.

---

## Win / Lose Conditions

| Condition | Result |
|-----------|--------|
| Survive 10 waves (`WIN_WAVES`) | Victory screen |
| Player HP ≤ 0 | Game Over screen |
| Adventurer walks onto a stove tile | Game Over ("smashed your tea station") |

Both screens display wave count and turn count, and offer a **Play Again** button that resets all state without regenerating the dungeon.

---

## Player

| Stat | Value |
|------|-------|
| Max HP | 30 |
| Defense | 2 |
| Hands | 2 (left + right), each holds one tea |

### Controls

| Key | Action |
|-----|--------|
| W / ↑ | Move forward |
| S / ↓ | Move backward |
| A | Strafe left |
| D | Strafe right |
| Q | Turn left (−90°) |
| E | Turn right (+90°) |
| I | Interact / close recipe menu |
| F | Toggle hidden passage / cancel traversal |
| . | Wait one turn |
| Esc | Close recipe menu |
| 1–4 | Select recipe in recipe menu |

Movement is grid-locked with a 150 ms lerp animation. The player fires `onStep` on every movement and on wait.

---

## Tea System

### Cooling

Tea loses `tempDropPerStep` degrees each turn. When temperature falls below the recipe's lower ideal bound the tea is marked **ruined**. A notification fires once per cup.

### Recipes

| Recipe | Brew Time | Ideal Temp | Ingredient Required |
|--------|-----------|-----------|---------------------|
| Green Tea | 15 steps | 60–75° | *(none — always available)* |
| Black Tea | 20 steps | 85–100° | Iron Rations |
| Oolong Tea | 18 steps | 70–85° | Wild Herbs |
| Herbal Brew | 25 steps | 65–80° | Arcane Dust |

Collected tea starts at `ideal high + 15°` (e.g. Black Tea starts at 115°).

### Serving Outcomes

| Tea State | Mob Response | Satiation Set To |
|-----------|-------------|-----------------|
| Ruined or below ideal temp | "Cold and ruined…" | 10 |
| Above ideal temp | "Scalding hot!" | 30 |
| Ideal temp, non-preferred recipe | "Perfectly brewed!" | 100 |
| Ideal temp, preferred recipe | "My favourite!" | 100 + preference bonus |

Preference bonus is configurable (default 50%, so preferred = 150 satiation).

---

## Stoves

- **Count**: 2, placed in the end room at distance-to-wall = 1, away from corridor entrances.
- Interact with I when facing a stove.
- If idle: opens recipe menu.
- If brewing: shows steps remaining.
- If ready: collect tea into a free hand.

Ingredients are consumed when brewing **starts**. The recipe menu shows ingredient cost and current stock, and greys out recipes you cannot afford.

---

## Mobs (Friendly)

Three mobs, one per non-end room, each with a preferred tea recipe.

| Mob | Preferred Recipe |
|-----|-----------------|
| Skeleton | Black Tea |
| Goblin | Green Tea |
| Troll | Herbal Brew |

| Stat | Value |
|------|-------|
| Starting satiation | 40 |
| Attack | 3 |
| Defense | 1 |

### Satiation States

| Range | Status | Minimap colour |
|-------|--------|---------------|
| > 100 | Ecstatic | Purple (#c3f) |
| 75–100 | Refreshed | Green (#3f5) |
| 50–74 | Sated | Blue (#08f) |
| 25–49 | Thirsty | Yellow (#fe0) |
| 1–24 | Gasping | Red (#f22) |
| ≤ 0 | Unconscious | Grey (#555) |

Satiation decreases by `satiationDropPerStep` each turn. Unconscious mobs can be revived by offering any tea.

Conscious mobs attack any adjacent adventurer each turn. Damage = max(1, mob.attack − adventurer.defense).

---

## Adventurers (Enemies)

### Types

| Type | Base HP | Attack | Defense | XP | Drop |
|------|---------|--------|---------|-----|------|
| Warrior | 20 | 5 | 2 | 30 | Iron Rations |
| Rogue | 12 | 7 | 1 | 25 | Wild Herbs |
| Mage | 10 | 9 | 0 | 40 | Arcane Dust |

### Wave Scaling

Each wave N (first wave is wave 1):

- **Count**: min(1 + N, 6)
- **HP**: base + (N − 1) × 3
- **Attack**: base + ⌊(N − 1) / 2⌋
- **XP**: base + (N − 1) × 5

Adventurers spawn at the rooms farthest from the end room.

### Factions

| Entity | Faction | Stance toward player | Stance toward mobs | Stance toward adventurers |
|--------|---------|---------------------|--------------------|--------------------------|
| Player | `player` | — | friendly | neutral |
| Mobs | `monster` | friendly | — | hostile |
| Adventurers | `adventurer` | neutral | hostile | — |

Player and mobs are in separate factions but treat each other as friendly. Adventurers are neutral to the player (will not attack) and hostile to mobs.

### AI Behaviour

Each turn the adventurer:

1. **Checks for monsters in line of sight.** If any conscious mob is visible:
   - If adjacent: attacks that mob (damage = max(1, attack − mob.defense)).
   - Otherwise: moves toward the nearest visible mob.
2. **Seeks the nearest stove** when no monster is in line of sight.

### Ghost Sighting Dialog

The player is a ghost. The first time each adventurer gains line-of-sight to the player (within 8 tiles), it blurts a one-off reaction line. The line is drawn randomly from a pool of surprised and bemused reactions. If the player is carrying at least one cup of tea, the line instead references a floating or disembodied cup of tea (the cup appears to move on its own because the ghost holding it is invisible to them).

Walking onto a stove tile triggers game over.

Attack damage = max(1, adventurer.attack − defender.defense).

---

## Ingredients

### Types

| Ingredient | ID | Source |
|------------|----|--------|
| Iron Rations | `rations` | Dropped by Warriors; world scatter |
| Wild Herbs | `herbs` | Dropped by Rogues; world scatter |
| Arcane Dust | `dust` | Dropped by Mages; world scatter |

### Initial World Scatter

At dungeon generation, 6 ingredient drops (2 of each type) are placed in random non-end rooms using a seeded RNG (`dungeonSeed ^ 0x1337beef`). They persist until picked up by the player or snatched by an adventurer.

### Pickup

The player automatically picks up an ingredient drop by walking onto its tile. Adventurers do the same.

### Inventory Display

Shown in the status bar: `Rations: X · Herbs: Y · Dust: Z`

---

## XP System

- Dropped by every adventurer that is killed by a mob.
- Player collects by walking onto the drop tile.
- Total XP shown in the status bar.
- XP drops appear as yellow circles on the minimap.

---

## Wave System

- A new wave spawns every `turnsPerWave` turns (default 120).
- Wave countdown overlay appears in the top-right of the viewport when ≤ 20 turns remain **and** there are no living adventurers.
- Game is won on wave 10.

---

## Hidden Passages

- 2 passages generated per dungeon.
- Each has a start cell and end cell; disabled by default.
- Stand on a start or end cell and press **F** to toggle.
- Walk into a passage entrance to begin traversal. Each step moves the player one cell along the passage at a cost of `1 / traversalFactor` turns (default 2×, so 2 passage cells = 1 turn).
- Press **F** mid-traversal to cancel.
- Passage cells shown on minimap: cyan (enabled) or dark cyan (disabled).

---

## Dungeon Generation

Uses a binary-space-partition (BSP) algorithm from the `mazetools` submodule.

### Default Values

| Parameter | Default |
|-----------|---------|
| Seed | 42 |
| Width | 32 cells |
| Height | 32 cells |
| Min leaf size | 6 |
| Max leaf size | 14 |
| Min room size | 3 |
| Max room size | 7 |

All parameters are live-editable in the World settings tab; changing any value instantly regenerates the dungeon and resets all game state.

---

## Difficulty Settings

All sliders are in the **Difficulty** tab of the settings sidebar.

| Setting | Default | Range | Effect |
|---------|---------|-------|--------|
| Cooling | 0.5°/step | 0–3, step 0.05 | Tea temperature lost per turn |
| Satiation loss | 0.5/step | 0–1, step 0.01 | Mob satiation lost per turn |
| Preference bonus | 50% | 0–100%, step 1 | Extra satiation when serving preferred tea |
| Turns per wave | 120 | 10–300, step 5 | Turns between adventurer waves |
| Passage speed | 2× | 0.25–4×, step 0.25 | Traversal speed multiplier for hidden passages |

---

## UI Overview

| Area | Content |
|------|---------|
| Header (top) | Title, dungeon seed, current wave number |
| 3D viewport (left) | First-person dungeon view; interaction prompt; recipe menu; message overlay; wave countdown |
| Hands HUD (bottom of viewport) | Left/right hand contents with tea name, temperature, ideal range, and status |
| Minimap sidebar (right) | 196×196 minimap with entity dots and tooltips; Difficulty and World settings tabs; keyboard reference |
| Status bar (bottom) | Grid coordinates, facing direction, HP (colour-coded), XP, ingredient inventory |
| Game Over / Win overlay | Full-screen modal with result, stats, and Play Again button |

### Minimap Entity Colours

| Entity | Colour |
|--------|--------|
| Player | Orange (#f80) with yellow facing arrow |
| Mob (by satiation status) | Purple / green / blue / yellow / red / grey |
| Adventurer — Warrior | Red (#e44) |
| Adventurer — Rogue | Magenta (#e4e) |
| Adventurer — Mage | Blue (#44e) |
| XP drop | Yellow (#fd0) |
| Ingredient drop | Cyan (#0df) |
| Passage (enabled) | Cyan (#0ff) |
| Passage (disabled) | Dark cyan (#066) |
