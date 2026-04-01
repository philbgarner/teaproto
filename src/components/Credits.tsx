import ModalPanel from "./ModalPanel";
import styles from "./styles/Credits.module.css";

interface CreditsProps {
  visible: boolean;
  onClose: () => void;
}

export default function Credits({ visible, onClose }: CreditsProps) {
  return (
    <ModalPanel
      visible={visible}
      onClose={onClose}
      title="Credits"
      closeButton
      scrollContents
      width="36vw"
      maxHeight="60vh"
    >
      <div className={styles.credits}>
        <div className={styles.section}>
          <div className={styles.role}>The Cutest Dungeon Design Team</div>
          <div className={styles.names}>Imaya, Clem &amp; Phil Garner</div>
        </div>
        <div className={styles.section}>
          <div className={styles.role}>Art</div>
          <div className={styles.names}>
            Imaya
            <a className={styles.link} href="https://imayazing.itch.io/" target="_blank" rel="noreferrer">
              imayazing.itch.io
            </a>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.role}>Programming</div>
          <div className={styles.names}>Clem, Phil</div>
        </div>
      </div>
    </ModalPanel>
  );
}
