import { useState, useEffect } from "react";
import { DEFAULT_KEYBINDINGS } from "../hooks/useKeybindings";
import styles from "./styles/KeybindingsPanel.module.css";
import { formatKey } from "./formatKey";

const ACTION_LABELS = {
  moveForward: "Move forward",
  moveBackward: "Move backward",
  strafeLeft: "Strafe left",
  strafeRight: "Strafe right",
  turnLeft: "Turn left",
  turnRight: "Turn right",
  interact: "Interact",
  wait: "Wait",
  discardLeft: "Discard left hand",
  discardRight: "Discard right hand",
  togglePassage: "Toggle passage",
  optionNext: "Menu: next option",
  optionPrev: "Menu: prev option",
  optionSelect: "Menu: select option",
  openMenu: "Open menu",
  summon: "Summon monster",
};

const KEY_DISPLAY = {
  " ": "space",
  space: "space",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  escape: "esc",
  enter: "enter",
  backspace: "bksp",
  tab: "tab",
  delete: "del",
  home: "home",
  end: "end",
  pageup: "pgup",
  pagedown: "pgdn",
};

function keyEventToHotkey(e) {
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Escape: "escape",
    Enter: "enter",
    " ": "space",
    Backspace: "backspace",
    Tab: "tab",
    Delete: "delete",
    Home: "home",
    End: "end",
    PageUp: "pageup",
    PageDown: "pagedown",
  };
  if (map[e.key]) return map[e.key];
  if (e.key.length === 1) return e.key.toLowerCase();
  if (/^F\d+$/.test(e.key)) return e.key.toLowerCase();
  return null;
}

export function KeybindingsPanel({ keybindings, setKeybindings }) {
  // capturing: { action, index } where index is a number (replace) or 'new' (add)
  const [capturing, setCapturing] = useState(null);

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      const hotkey = keyEventToHotkey(e);
      if (!hotkey) return;
      const { action, index } = capturing;
      const current = keybindings[action] ?? [];
      let next;
      if (index === "new") {
        if (current.includes(hotkey)) {
          setCapturing(null);
          return;
        }
        next = [...current, hotkey];
      } else {
        next = current.map((k, i) => (i === index ? hotkey : k));
      }
      setKeybindings({ ...keybindings, [action]: next });
      setCapturing(null);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [capturing, keybindings, setKeybindings]);

  const removeKey = (action, index) => {
    const next = (keybindings[action] ?? []).filter((_, i) => i !== index);
    setKeybindings({ ...keybindings, [action]: next });
  };

  return (
    <div className={styles.panel}>
      {Object.entries(ACTION_LABELS).map(([action, label]) => {
        const keys = keybindings[action] ?? [];
        return (
          <div key={action} className={styles.actionRow}>
            <div className={styles.actionLabel}>{label}</div>
            <div className={styles.keysRow}>
              {keys.map((key, i) => {
                const isCapturing =
                  capturing?.action === action && capturing?.index === i;
                return (
                  <span
                    key={i}
                    className={`${styles.chip} ${isCapturing ? styles.chipCapturing : ""}`}
                  >
                    <span
                      onClick={() =>
                        setCapturing(isCapturing ? null : { action, index: i })
                      }
                    >
                      {isCapturing ? "..." : formatKey(key, KEY_DISPLAY)}
                    </span>
                    <span
                      className={styles.chipRemove}
                      onClick={() => removeKey(action, i)}
                    >
                      ✕
                    </span>
                  </span>
                );
              })}
              <span
                className={`${styles.chip} ${styles.chipAdd} ${
                  capturing?.action === action && capturing?.index === "new"
                    ? styles.chipCapturing
                    : ""
                }`}
                onClick={() =>
                  setCapturing(
                    capturing?.action === action && capturing?.index === "new"
                      ? null
                      : { action, index: "new" },
                  )
                }
              >
                {capturing?.action === action && capturing?.index === "new"
                  ? "..."
                  : "+"}
              </span>
            </div>
          </div>
        );
      })}
      <button
        className={styles.resetBtn}
        onClick={() => {
          setKeybindings({ ...DEFAULT_KEYBINDINGS });
          setCapturing(null);
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}
