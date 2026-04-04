import { useCallback, useRef, useState } from "react";
import { useSoundHelper } from "./useSoundHelper";

/**
 * Manages a transient HUD message that auto-dismisses after a timeout.
 * Reveals the message with a typewriter animation.
*
 * @param {number} [duration=5000] - How long (ms) each message stays visible.
 * @param {number} [charDelay=28] - Ms between each revealed character.
 * @returns {{ message: string|null, displayedText: string|null, setMessage: Function, showMsg: (text: string) => void }}
 */
const MAX_LOG = 15;

export function useMessage(duration = 5000, charDelay = 28) {
  const [message, setMessageState] = useState(null);
  const [displayedText, setDisplayedText] = useState(null);
  const [messageLog, setMessageLog] = useState([]);
  const timerRef = useRef(null);
  const typewriterRef = useRef(null);

  const { sounds } = useSoundHelper();

  // Play beep sound once every N characters
  const BEEP_FREQUENCY = 4;

  const clearAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (typewriterRef.current) clearInterval(typewriterRef.current);
  }, []);

  const showMsg = useCallback(
    (text) => {
      clearAll();
      setMessageState(text);
      setDisplayedText("");
      setMessageLog((prev) => [...prev.slice(-(MAX_LOG - 1)), { text }]);

      let i = 0;
      typewriterRef.current = setInterval(() => {
        i++;
        setDisplayedText(text.slice(0, i));
        // Play beep only every BEEP_FREQUENCY characters
        if (i % BEEP_FREQUENCY === 0) {
          sounds.playRandomBeep();
        }
        if (i >= text.length) clearInterval(typewriterRef.current);
      }, charDelay);

      timerRef.current = setTimeout(() => {
        clearAll();
        setMessageState(null);
        setDisplayedText(null);
      }, duration);
    },
    [duration, charDelay, clearAll],
  );

  // setMessage is exposed for external clears (e.g. game reset)
  const setMessage = useCallback(
    (val) => {
      clearAll();
      setMessageState(val);
      setDisplayedText(val);
    },
    [clearAll],
  );

  const logDialog = useCallback((speaker, text) => {
    setMessageLog((prev) => [...prev.slice(-(MAX_LOG - 1)), { text, speaker }]);
  }, []);

  return { message, displayedText, setMessage, showMsg, messageLog, logDialog };
}
