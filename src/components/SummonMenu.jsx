import ModalPanel from "./ModalPanel";
import { formatKey } from "./formatKey";

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

/**
 * Modal overlay for selecting which monster to summon to the player's location.
 *
 * @param {{
 *   mobs: { name: string }[],
 *   selectedIndex: number,
 *   onSelectMob: (mobIdx: number) => void,
 *   onCancel: () => void,
 *   keybindings: object,
 * }} props
 */
export function SummonMenu({
  mobs,
  selectedIndex,
  onSelectMob,
  onCancel,
  keybindings,
}) {
  const fmtKeys = (keys) =>
    (keys ?? []).map((k) => formatKey(k, KEY_DISPLAY)).join("/") || "-";

  return (
    <ModalPanel
      visible
      title="Summon Monster"
      closeButton
      onClose={onCancel}
      scrollContents={mobs.length > 8}
      width="36vw"
      maxHeight="50vh"
    >
      <div style={{ fontFamily: "'Metamorphous', serif" }}>
        {mobs.map((mob, i) => {
          const isCursor = i === selectedIndex;
          return (
            <div
              key={i}
              onClick={() => {
                if (mob.hasMet) {
                  onSelectMob(i);
                }
              }}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                borderRadius: 3,
                marginBottom: 4,
                background: isCursor
                  ? "rgba(255,200,0,0.15)"
                  : "rgba(255,255,255,0.05)",
                border: isCursor
                  ? "1px solid rgba(255,200,0,0.4)"
                  : "1px solid transparent",
                fontSize: 13,
                color: "#eee",
                opacity: mob.hasMet ? "1.0" : "0.3",
              }}
              disable={!mob.hasMet}
            >
              <span style={{ color: "#fa0" }}>[{i + 1}]</span>{" "}
              {mob.name ?? "Monster"} {!mob.hasMet ? "(Has not met you)" : ""}
            </div>
          );
        })}
        <div style={{ marginTop: 10, color: "#555", fontSize: 11 }}>
          {fmtKeys(keybindings?.optionPrev)}/{fmtKeys(keybindings?.optionNext)}{" "}
          to navigate · {fmtKeys(keybindings?.optionSelect)} to select · number
          to pick · {fmtKeys(keybindings?.cancel)} to cancel
        </div>
      </div>
    </ModalPanel>
  );
}
