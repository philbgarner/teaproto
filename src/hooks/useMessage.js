import { useCallback, useRef, useState } from "react";

/**
 * Manages a transient HUD message that auto-dismisses after a timeout.
 *
 * Stores the active message in state and a timer handle in a ref so that
 * calling `showMsg` while a message is already visible resets the timer
 * instead of stacking messages. The message clears itself after `duration`
 * milliseconds.
 *
 * @param {number} [duration=5000] - How long (ms) each message stays visible.
 * @returns {{ message: string|null, showMsg: (text: string) => void }}
 *
 * @example
 * function GameHUD() {
 *   const { message, showMsg } = useMessage();
 *
 *   return (
 *     <>
 *       <button onClick={() => showMsg("Tea is ready!")}>Brew</button>
 *       {message && <div className="hud-message">{message}</div>}
 *     </>
 *   );
 * }
 */
export function useMessage(duration = 5000) {
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);

  const showMsg = useCallback(
    (text) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(text);
      timerRef.current = setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  return { message, setMessage, showMsg };
}
