import { useRef } from "react";
import { Howl } from "howler";

/**
 * A React hook that manages a single audio track using Howler.js.
 *
 * Creates a `Howl` instance on first render and stores it in a ref so it
 * persists across re-renders without triggering re-renders itself. Calling
 * `play()` always restarts the track from the beginning (stop then play),
 * which makes it suitable for sound effects as well as looping background
 * music.
 *
 * @param {string} src - Path or URL to the audio file.
 * @param {object} [options]
 * @param {number} [options.volume=1.0] - Playback volume between 0.0 and 1.0.
 * @param {boolean} [options.loop=false] - Whether the track loops continuously.
 * @returns {{ play: () => void, stop: () => void }}
 *
 * @example
 * function BackgroundMusic() {
 *   const { play, stop } = useMusic("/music/theme.mp3", { volume: 0.5, loop: true });
 *
 *   return (
 *     <>
 *       <button onClick={play}>Play</button>
 *       <button onClick={stop}>Stop</button>
 *     </>
 *   );
 * }
 */
export function useMusic(src, { volume = 1.0, loop = false } = {}) {
  const howlRef = useRef(null);
  if (howlRef.current === null) {
    howlRef.current = new Howl({ src: [src], volume, loop });
  }

  function play() {
    howlRef.current.stop();
    howlRef.current.play();
  }

  function stop() {
    howlRef.current.stop();
  }

  return { play, stop };
}
