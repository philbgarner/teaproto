import { MoveActions } from "../hooks/useEotBCamera";
import { useSettings } from "../SettingsContext";
import styles from "./styles/ArrowMovement.module.css";

const KEY_DISPLAY: Record<string, string> = {
  up: "↑", down: "↓", left: "←", right: "→", space: "Space",
};

function formatKeys(keys: string[]): string {
  return keys.map((k) => KEY_DISPLAY[k] ?? k.toUpperCase()).join("/");
}

interface Props {
  moveActions: MoveActions;
  onInteract?: () => void;
}

function MoveBtn({
  onPress,
  img,
  label,
}: {
  onPress: () => void;
  img: string;
  label: string;
}) {
  return (
    <button
      className={styles.btn}
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      title={label}
    >
      <img src={`textures/${img}`} alt={label} draggable={false} />
    </button>
  );
}

export function ArrowMovement({ moveActions, onInteract }: Props) {
  const { keybindings } = useSettings();

  return (
    <div className={styles.dpad}>
      <div className={styles.row}>
        <MoveBtn onPress={moveActions.turnLeft}    img="turn-left.png"     label={`Turn left (${formatKeys(keybindings.turnLeft)})`} />
        <MoveBtn onPress={moveActions.moveForward} img="move-forward.png"  label={`Move forward (${formatKeys(keybindings.moveForward)})`} />
        <MoveBtn onPress={moveActions.turnRight}   img="turn-right.png"    label={`Turn right (${formatKeys(keybindings.turnRight)})`} />
      </div>
      <div className={styles.row}>
        <MoveBtn onPress={moveActions.strafeLeft}  img="move-left.png"     label={`Strafe left (${formatKeys(keybindings.strafeLeft)})`} />
        {onInteract ? (
          <button
            className={styles.btn}
            onPointerDown={(e) => { e.preventDefault(); onInteract(); }}
            title={`Interact (${formatKeys(keybindings.interact)})`}
          />
        ) : (
          <div className={styles.gap} />
        )}
        <MoveBtn onPress={moveActions.strafeRight} img="move-right.png"    label={`Strafe right (${formatKeys(keybindings.strafeRight)})`} />
      </div>
      <div className={styles.row}>
        <div className={styles.gap} />
        <MoveBtn onPress={moveActions.moveBackward} img="move-backward.png" label={`Move backward (${formatKeys(keybindings.moveBackward)})`} />
        <div className={styles.gap} />
      </div>
    </div>
  );
}
