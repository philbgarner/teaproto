# Credits

Art: Imaya
https://imayazing.itch.io/

Programming: Clem

Programming: Phil Garner

## References

NOT AI ART!

# Tea Proto

A first-person dungeon crawler where you brew and serve tea to keep friendly mobs alive against the invading adventurers.

Test

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm

### Clone and Install

This project uses a git submodule (`roguelike-mazetools`) for dungeon generation and rendering. Make sure to clone with submodules:

```bash
git clone --recurse-submodules git@github.com:philbgarner/teaproto.git
cd teaproto
```

If you already cloned without `--recurse-submodules`, initialize the submodule manually:

```bash
git submodule update --init --recursive
```

### Install Dependencies

```bash
npm install
```

### Run

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`) in your browser.

---

## Game Rules

### Overview

You play as a tea keeper in a procedurally generated dungeon. Your goal is to brew and serve tea to friendly mobs to keep their satiation up. Every few turns, waves of hostile adventurers spawn and march through the dungeon — attacking your mobs and you. Keep your mobs conscious and well-fed so they can fight back.

---

### Movement

| Key | Action |
|-----|--------|
| `W` / `↑` | Move forward |
| `S` / `↓` | Move backward |
| `A` | Strafe left |
| `D` | Strafe right |
| `←` | Turn left |
| `→` | Turn right |
| `.` (period) | Wait one turn (advance time without moving) |
| `I` | Interact with stove or mob you are facing |

Movement is tile-based. Each step advances the game by one turn.

---

### Brewing Tea

Two stoves are placed in the starting room. To brew tea:

1. Face a stove and press `I` to open the recipe menu.
2. Press a number key (`1`–`4`) to select a recipe.
3. Walk around while the tea brews — each step counts down the brew timer.
4. When the tea is ready, face the stove and press `I` to pick it up.

Tea goes into your hands (left or right). You can hold up to two teas at once.

#### Recipes

| Tea | Brew Time (steps) | Ideal Temp Range |
|-----|-------------------|-----------------|
| Green Tea | 15 | 60–75 |
| Black Tea | 20 | 85–100 |
| Oolong Tea | 18 | 70–85 |
| Herbal Brew | 25 | 65–80 |

Tea starts 15 degrees above the top of its ideal range when picked up. It cools by a set amount each step (default: 0.5°/step). If it drops below the minimum ideal temperature it becomes **ruined**.

---

### Serving Tea

Each mob has a preferred recipe. To serve tea:

1. Face a mob and press `I`.
2. The tea in your hands is offered automatically (left hand first, then right).

#### Outcomes

| Condition | Satiation Set To | Mob Says |
|-----------|-----------------|----------|
| Tea is ruined or too cold | 10 | Disappointed |
| Tea is too hot (above ideal range) | 30 | Scalded |
| Tea is at correct temperature | 100 | Satisfied |
| Tea is correct temperature **and** preferred recipe | 100 + supersatiation bonus (default +50) | Overjoyed |

If a mob is **ecstatic** (satiation > 100) it will refuse another serving.

Mobs also have contextual dialogue when approached empty-handed based on how thirsty they are.

---

### Satiation and Mob Statuses

Each mob starts at satiation 40. Satiation drops every turn (default: 0.5/step). If satiation reaches 0 the mob falls **unconscious**.

| Status | Satiation Range | Color |
|--------|----------------|-------|
| Gasping | 0–24 | Red |
| Thirsty | 25–49 | Yellow |
| Sated | 50–74 | Blue |
| Refreshed | 75–100 | Green |
| Ecstatic | > 100 | Purple |

Mob color in the 3D view and minimap reflects their current status. Unconscious mobs turn grey.

---

### Adventurer Waves

Every N turns (default: 120) a new wave of adventurers spawns in the rooms farthest from the player's starting room. Wave number increases each cycle.

#### Wave Scaling

- Wave 1: 2 adventurers. Each subsequent wave adds one more, up to 6.
- HP and attack increase with each wave (`+3 HP/wave`, `+1 attack every 2 waves`).
- XP reward also increases (`+5 XP/wave`).

#### Adventurer Types

| Type | HP | Attack | Defense | XP |
|------|----|--------|---------|-----|
| Warrior | 20 | 5 | 2 | 30 |
| Rogue | 12 | 7 | 1 | 25 |
| Mage | 10 | 9 | 0 | 40 |

Adventurers use greedy pathfinding to move toward the nearest conscious mob or the player, whichever is closer. When adjacent they attack.

---

### Combat

**Adventurers attack mobs and the player:**
- Damage = max(1, attacker.attack − target.defense)
- Player defense: 2, Player max HP: 30
- Mob defense: 1

When an adventurer attacks a mob, it reduces that mob's satiation — a well-fed mob that gets hit loses satiation toward unconsciousness.

**Conscious mobs counterattack:**
- Each conscious mob attacks one adjacent adventurer per turn.
- If an adventurer's HP reaches 0 it dies and drops an XP pickup at its location.

**XP pickups** are collected automatically when the player walks over them.

---

### Minimap

A minimap is displayed in the sidebar. Hover over mob icons for a tooltip showing name, status, and satiation. Adventurers are shown in their class color. XP drops appear as gold dots.

---

### Settings

A settings panel lets you tune difficulty:

- **Seed / dimensions** — regenerate the dungeon
- **Temperature drop per step** — how fast tea cools
- **Satiation drop per step** — how fast mobs get thirsty
- **Supersatiation bonus** — extra satiation awarded for preferred-recipe tea (as a percentage of the base 100)
- **Turns per wave** — how often adventurer waves spawn
