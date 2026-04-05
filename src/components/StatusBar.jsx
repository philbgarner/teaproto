import ModalPanel from "./ModalPanel";
import styles from "./styles/StatusBar.module.css";
import menuStyles from "./styles/MenuOverlay.module.css";
import { useEffect, useState } from "react";
import hotkeys from "hotkeys-js";
import { useSettings } from "../SettingsContext";

/**
 * Bottom status bar showing position, facing direction, HP, XP, and
 * ingredient inventory.
 *
 * @param {{
 *   camera: { x: number, z: number, yaw: number },
 *   facing: string,
 *   playerHp: number,
 *   playerMaxHp: number,
 *   playerXp: number,
 *   ingredients: { "hot-pepper": 0, "wild-herb": 0, "frost-leaf": 0 },
 *   openMenuKeys: string[],
 *   onOpenSettings: () => void,
 * }} props
 */

const HELP_TEXT = `Welcome to Cutest Dungeon!

You are a poltergeist hired by the Earl of Grey to refresh his dungeon.
As a ghost, traps and residents won't harm you - and you can walk through walls.
Be warned: you cannot phase through walls while carrying tea.

Move with W/A/S/D, rotate with Q & E. Interact with Space.
Use the minimap to navigate; the TeaOMatic is marked with an orange dot.
Brew tea and bring it to your monsters to restore and protect them.

Tea acts as armour - adventurers must burn through a monster's tea supply before dealing real damage.
Each adventurer deals a different type of elemental damage, and only the matching tea colour heals it:
  red damage is healed by blue (ice) tea, green by red, and blue by green.
If all monsters fall unconscious, the adventurers will destroy the TeaOMatic.

Adventurers drop gold when they leave - collect enough to persuade a dragon to move in.
Secret passages let you move around the dungeon faster when your hands are full.
Reset sprung traps and close open doors with Space so adventurers can enjoy them.

Press M to open this menu at any time.
Keybindings can be customised in Settings → Keys.`;

export function StatusBar({
  camera,
  facing,
  playerXp,
  openMenuKeys,
  summonMonsterKeys,
  discardLeftKeys,
  discardRightKeys,
  onOpenSettings,
  onReturnToTitle,
  dungeonSeed,
}) {
  const { keybindings } = useSettings();
  const [showMenu, setShowMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (dungeonSeed === 42) setShowHelp(true);
  }, []);

  useEffect(() => {
    const keys = (openMenuKeys ?? ["m"]).join(",");
    const handler = (e) => {
      e.preventDefault();
      setShowMenu((v) => !v);
    };
    hotkeys(keys, handler);
    return () => hotkeys.unbind(keys, handler);
  }, [openMenuKeys]);

  const menuItems = [
    {
      label: "Help",
      onClick: () => {
        setShowMenu(false);
        setShowHelp(true);
      },
    },
    {
      label: "Settings",
      onClick: () => {
        setShowMenu(false);
        onOpenSettings?.();
      },
    },
    {
      label: "Back to Title Screen",
      onClick: () => {
        setShowMenu(false);
        onReturnToTitle?.();
      },
    },
  ];

  return (
    <>
      <div className={styles.bar}>
        <span className={styles.coords}>
          ({Math.floor(camera.x)}, {Math.floor(camera.z)})
        </span>
        <span className={styles.facing}>Facing: {facing}</span>
        <span className={styles.xp}>Gold: {playerXp}</span>
        <span className={styles.roomTemp}>
          {(openMenuKeys?.[0] ?? "m").toUpperCase()}: Menu
        </span>
        <span className={styles.roomTemp}>
          {(discardLeftKeys?.[0] ?? "z").toUpperCase()}: Discard Left
        </span>
        <span className={styles.roomTemp}>
          {(discardRightKeys?.[0] ?? "x").toUpperCase()}: Discard Right
        </span>
        <span className={styles.roomTemp}>
          {(keybindings?.switchHand?.[0] ?? "f").toUpperCase()}: Change Hand Selection
        </span>
        {summonMonsterKeys?.[0] && (
          <span className={styles.roomTemp}>
            {summonMonsterKeys[0].toUpperCase()}: Summon
          </span>
        )}
      </div>

      <ModalPanel
        visible={showMenu}
        title="Menu"
        closeButton
        onClose={() => setShowMenu(false)}
        width="20vw"
      >
        <div className={menuStyles.menuList}>
          {menuItems.map(({ label, onClick }) => (
            <button
              key={label}
              className={menuStyles.menuItem}
              onClick={onClick}
            >
              {label}
            </button>
          ))}
        </div>
      </ModalPanel>

      <ModalPanel
        visible={showHelp}
        title="Help"
        closeButton
        onClose={() => setShowHelp(false)}
        width="36vw"
        maxHeight="50vh"
        scrollContents
      >
        <pre className={menuStyles.helpText}>{HELP_TEXT}</pre>
      </ModalPanel>
    </>
  );
}
