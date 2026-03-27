import React, { useEffect } from "react";
import BorderPanel from "./BorderPanel";
import Button from "./Button";
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
  top,
  bottom,
  opacity,
}: ModalPanelProps) {
  useEffect(() => {
    if (!visible && onClose) {
      onClose();
    }
  }, [visible]);

  const w = width || "40vw";
  const wNum = parseFloat(w);
  const wUnit = w.replace(/[\d.]/g, "");

  return visible ? (
    <div className={styles.modalPanelBackdrop} style={{ opacity, transition: "opacity 0.15s" }}>
      <BorderPanel
        background="#191919"
        width={w}
        height={maxHeight || "40vh"}
        top={top ?? "calc(50vh - 20vh)"}
        left={`calc(50vw - ${wNum / 2}${wUnit})`}
        hidden={!visible}
        title={title}
        flexMode="Column"
      >
        {closeButton && (
          <div className={styles.closeButton}>
            <Button background="#191919" onClick={onClose} maxWidth="4rem">
              ✕
            </Button>
          </div>
        )}
        <div
          style={{
            padding: "1rem",
            overflowY: scrollContents ? "scroll" : "hidden",
          }}
        >
          {children}
        </div>
      </BorderPanel>
    </div>
  ) : null;
}
