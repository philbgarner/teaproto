import { useRef } from "react";
import { Howl } from "howler";

/**
 * A React hook that manages a sound effect using Howler.js.
 *
 * Unlike `useMusic`, calling `play()` does NOT stop the current playback
 * first — each call spawns an independent sound instance, so rapid or
 * overlapping triggers stack naturally (e.g. footsteps, hits, UI clicks).
 *
 * @param {string} src - Path or URL to the audio file.
 * @param {object} [options]
 * @param {number} [options.volume=1.0] - Playback volume between 0.0 and 1.0.
 * @returns {{ play: () => void, stop: () => void }}
 *
 * @example
 * function SwordSwing() {
 *   const { play } = useSfx("/sfx/sword.mp3", { volume: 0.8 });
 *   return <button onClick={play}>Swing</button>;
 * }
 */
export function useSfx(src, { volume = 1.0 } = {}) {
  const howlRef = useRef(null);
  if (howlRef.current === null) {
    howlRef.current = new Howl({ src: [src], volume });
  }

  function play() {
    howlRef.current.play();
  }

  function stop() {
    howlRef.current.stop();
  }

  return { play, stop };
}
