import styles from "./styles/GameHeader.module.css";

/**
 * Top header bar showing the game title, dungeon seed, and current wave number.
 *
 * @param {{ dungeonSeed: number, currentWave: number, onSettingsClick: () => void }} props
 */
export function GameHeader({ dungeonSeed, currentWave, onSettingsClick, onRandomizeSeed }) {
  return (
    <div className={styles.header}>
      <span className={styles.title}>Tea Dungeon</span>
      <span className={styles.seed}>seed: {dungeonSeed}</span>
      <button className={styles.btn} onClick={onRandomizeSeed}>
        rng
      </button>
      <span className={`${styles.wave} ${currentWave > 0 ? styles.waveActive : styles.waveInactive}`}>
        Wave {currentWave}
      </span>
      <button className={styles.btn} onClick={onSettingsClick}>
        settings
      </button>
    </div>
  );
}
