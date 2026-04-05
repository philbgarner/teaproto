import { MoveActions } from "../hooks/useEotBCamera";
import styles from "./styles/ArrowMovement.module.css";

interface Props {
  moveActions: MoveActions;
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

export function ArrowMovement({ moveActions }: Props) {
  return (
    <div className={styles.dpad}>
      <div className={styles.row}>
        <MoveBtn onPress={moveActions.turnLeft}    img="turn-left.png"     label="Turn left" />
        <MoveBtn onPress={moveActions.moveForward} img="move-forward.png"  label="Move forward" />
        <MoveBtn onPress={moveActions.turnRight}   img="turn-right.png"    label="Turn right" />
      </div>
      <div className={styles.row}>
        <MoveBtn onPress={moveActions.strafeLeft}  img="move-left.png"     label="Strafe left" />
        <div className={styles.gap} />
        <MoveBtn onPress={moveActions.strafeRight} img="move-right.png"    label="Strafe right" />
      </div>
      <div className={styles.row}>
        <div className={styles.gap} />
        <MoveBtn onPress={moveActions.moveBackward} img="move-backward.png" label="Move backward" />
        <div className={styles.gap} />
      </div>
    </div>
  );
}
