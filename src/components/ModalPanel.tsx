import React from "react";
import styles from "./styles/ModalPanelBackdrop.module.css";

export interface ModalPanelProps {
  children: React.ReactNode;
  title?: string;
  closeButton?: boolean;
  scrollContents?: boolean;
  onClose?: () => void;
  visible?: boolean;
  maxHeight?: string;
  width?: string;
  top?: string;
  opacity?: number;
}

export default function ModalPanel({
  children,
  visible,
  title,
  closeButton,
  onClose,
  maxHeight,
  scrollContents,
  width,
  opacity,
}: ModalPanelProps) {
  if (!visible) return null;

  return (
    <div
      className={styles.backdrop}
      style={{ opacity, transition: "opacity 0.15s" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={styles.panel}
        style={{ width: width ?? "40vw", maxHeight: maxHeight ?? "40vh" }}
      >
        {(title || closeButton) && (
          <div className={styles.header}>
            {title && <span className={styles.title}>{title}</span>}
            {closeButton && (
              <button className={styles.closeBtn} onClick={onClose}>
                ✕
              </button>
            )}
          </div>
        )}
        <div className={`${styles.body} ${scrollContents ? styles.bodyScroll : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
