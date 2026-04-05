import { useState } from "react";

export const DEFAULT_KEYBINDINGS = {
  moveForward: ["w", "up"],
  moveBackward: ["s", "down"],
  strafeLeft: ["a"],
  strafeRight: ["d"],
  turnLeft: ["q"],
  turnRight: ["e"],
  interact: ["space"],
  wait: ["."],
  discardLeft: ["z"],
  discardRight: ["x"],
  togglePassage: ["space"],
  optionNext: ["tab", "down"],
  optionPrev: ["up"],
  optionSelect: ["space"],
  openMenu: ["m"],
  summon: ["n"],
  cancel: ["x"],
  switchHand: ["f"],
};

function loadKeybindings() {
  try {
    const stored = localStorage.getItem("tea-keybindings");
    if (stored) return { ...DEFAULT_KEYBINDINGS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_KEYBINDINGS };
}

export function useKeybindings() {
  const [keybindings, setKeybindingsState] = useState(loadKeybindings);

  const setKeybindings = (next) => {
    setKeybindingsState(next);
    try {
      localStorage.setItem("tea-keybindings", JSON.stringify(next));
    } catch {}
  };

  return [keybindings, setKeybindings];
}
