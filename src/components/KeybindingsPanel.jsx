import { useState, useEffect } from "react";
import { DEFAULT_KEYBINDINGS } from "../hooks/useKeybindings";

const ACTION_LABELS = {
  moveForward:   "Move forward",
  moveBackward:  "Move backward",
  strafeLeft:    "Strafe left",
  strafeRight:   "Strafe right",
  turnLeft:      "Turn left",
  turnRight:     "Turn right",
  interact:      "Interact",
  wait:          "Wait",
  discardLeft:   "Discard left hand",
  discardRight:  "Discard right hand",
  togglePassage: "Toggle passage",
  optionNext:    "Menu: next option",
  optionPrev:    "Menu: prev option",
  optionSelect:  "Menu: select option",
};

const KEY_DISPLAY = {
  " ": "space", "space": "space",
  "up": "↑", "down": "↓", "left": "←", "right": "→",
  "escape": "esc", "enter": "enter", "backspace": "bksp",
  "tab": "tab", "delete": "del", "home": "home", "end": "end",
  "pageup": "pgup", "pagedown": "pgdn",
};

export function formatKey(k) {
  return KEY_DISPLAY[k] ?? KEY_DISPLAY[k.toLowerCase()] ?? k;
}

function keyEventToHotkey(e) {
  const map = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    Escape: "escape", Enter: "enter", " ": "space", Backspace: "backspace",
    Tab: "tab", Delete: "delete", Home: "home", End: "end",
    PageUp: "pageup", PageDown: "pagedown",
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
        if (current.includes(hotkey)) { setCapturing(null); return; }
        next = [...current, hotkey];
      } else {
        next = current.map((k, i) => i === index ? hotkey : k);
      }
      setKeybindings({ ...keybindings, [action]: next });
      setCapturing(null);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [capturing, keybindings, setKeybindings]);

  const removeKey = (action, index) => {
    const next = (keybindings[action] ?? []).filter((_, i) => i !== index);
    setKeybindings({ ...keybindings, [action]: next });
  };

  const chipStyle = (isCapturing) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    background: isCapturing ? "#334" : "#222",
    border: `1px solid ${isCapturing ? "#558" : "#444"}`,
    color: isCapturing ? "#aaf" : "#ccc",
    fontSize: 10,
    padding: "1px 5px",
    cursor: "pointer",
    fontFamily: "'Metamorphous', serif",
    borderRadius: 2,
    userSelect: "none",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Object.entries(ACTION_LABELS).map(([action, label]) => {
        const keys = keybindings[action] ?? [];
        return (
          <div key={action} style={{ fontSize: 11, color: "#888" }}>
            <div style={{ marginBottom: 3 }}>{label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
              {keys.map((key, i) => {
                const isCapturing = capturing?.action === action && capturing?.index === i;
                return (
                  <span key={i} style={chipStyle(isCapturing)}>
                    <span onClick={() => setCapturing(isCapturing ? null : { action, index: i })}>
                      {isCapturing ? "..." : formatKey(key)}
                    </span>
                    <span
                      onClick={() => removeKey(action, i)}
                      style={{ color: "#555", marginLeft: 3, lineHeight: 1 }}
                    >
                      ✕
                    </span>
                  </span>
                );
              })}
              <span
                style={chipStyle(capturing?.action === action && capturing?.index === "new")}
                onClick={() =>
                  setCapturing(
                    capturing?.action === action && capturing?.index === "new"
                      ? null
                      : { action, index: "new" }
                  )
                }
              >
                {capturing?.action === action && capturing?.index === "new" ? "..." : "+"}
              </span>
            </div>
          </div>
        );
      })}
      <button
        onClick={() => { setKeybindings({ ...DEFAULT_KEYBINDINGS }); setCapturing(null); }}
        style={{
          marginTop: 4,
          background: "#222",
          border: "1px solid #444",
          color: "#666",
          fontSize: 10,
          padding: "3px 6px",
          cursor: "pointer",
          fontFamily: "'Metamorphous', serif",
          alignSelf: "flex-start",
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}
