import ModalPanel from "./ModalPanel";
import styles from "./styles/StatusBar.module.css";
import menuStyles from "./styles/MenuOverlay.module.css";
import { useEffect, useState } from "react";
import hotkeys from "hotkeys-js";

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

const HELP_TEXT = `Welcome to Teaproto.

Move with W/A/S/D or arrow keys. Interact with Space.
Brew tea at the stove to warm adventurers and earn gold.
Watch your ingredient stocks — restock from chests.

Press M to open this menu at any time.
Keybindings can be customised in Settings → Keys.`;

export function StatusBar({
  camera,
  facing,
  playerXp,
  ingredients,
  openMenuKeys,
  summonMonsterKeys,
  onOpenSettings,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
  ];
  console.log("ingredients", ingredients);
  return (
    <>
      <div className={styles.bar}>
        <span className={styles.coords}>
          ({Math.floor(camera.x)}, {Math.floor(camera.z)})
        </span>
        <span className={styles.facing}>Facing: {facing}</span>
        <span className={styles.xp}>Gold: {playerXp}</span>
        <span className={styles.ingredients}>
          Hot Peppers: {ingredients.hotPeppers} · Herbs: {ingredients.wildHerbs}{" "}
          · Frost Leaves: {ingredients.frostLeaves}
          {ingredients.dust}
        </span>
        <span className={styles.roomTemp}>
          {(openMenuKeys?.[0] ?? "m").toUpperCase()}: Menu
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
