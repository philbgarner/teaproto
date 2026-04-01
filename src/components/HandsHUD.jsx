import styles from "./styles/HandsHUD.module.css";

/**
 * Fixed bottom HUD overlay showing hand images on both sides of the screen
 * with temperature images positioned outside each hand and cup overlays
 * when tea is being held. Cup position varies by tea type.
 *
 * @param {{ left: object|null, right: object|null }} hands - Left and right held tea items.
 */
export function HandsHUD({ hands }) {
  const getTeaTypeClass = (tea) => {
    if (!tea) return '';
    return tea.name?.toLowerCase().replace(/\s+/g, '-') || '';
  };

  return (
    <>
      <div className={styles.handImageLeft}>
        <img 
          src={`${import.meta.env.BASE_URL}textures/hand.png`} 
          alt="Left Hand" 
          className={styles.handImg}
        />
        <img 
          src={`${import.meta.env.BASE_URL}textures/temperature.png`} 
          alt="Temperature" 
          className={styles.temperatureImg}
        />
        {hands.left && (
          <div className={styles.cupContainer}>
            <img 
              src={`${import.meta.env.BASE_URL}textures/icons_scaled_4x_pngcrushed.png`} 
              alt="Cup" 
              className={`${styles.cupImg} ${styles[`cup-${getTeaTypeClass(hands.left)}`]}`}
            />
          </div>
        )}
      </div>
      <div className={styles.handImageRight}>
        <img 
          src={`${import.meta.env.BASE_URL}textures/hand.png`} 
          alt="Right Hand" 
          className={styles.handImg}
        />
        <img 
          src={`${import.meta.env.BASE_URL}textures/temperature.png`} 
          alt="Temperature" 
          className={styles.temperatureImg}
        />
        {hands.right && (
          <div className={styles.cupContainer}>
            <img 
              src={`${import.meta.env.BASE_URL}textures/icons_scaled_4x_pngcrushed.png`} 
              alt="Cup" 
              className={`${styles.cupImg} ${styles[`cup-${getTeaTypeClass(hands.right)}`]}`}
            />
          </div>
        )}
      </div>
    </>
  );
}
