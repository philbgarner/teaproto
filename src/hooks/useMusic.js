import { useRef, useEffect } from "react";
import { Howl } from "howler";

export function useMusic(src, { volume = 1.0, loop = false, volumeMultiplier = 1.0 } = {}) {
  const baseVolumeRef = useRef(volume);
  const howlRef = useRef(null);
  if (howlRef.current === null) {
    howlRef.current = new Howl({ src: [src], volume: volume * volumeMultiplier, loop });
  }

  useEffect(() => {
    howlRef.current.volume(baseVolumeRef.current * volumeMultiplier);
  }, [volumeMultiplier]);

  function play() {
    howlRef.current.stop();
    howlRef.current.play();
  }

  function stop() {
    howlRef.current.stop();
  }

  function fadeOut(duration = 500) {
    const h = howlRef.current;
    h.fade(h.volume(), 0, duration);
    setTimeout(() => h.stop(), duration);
  }

  function fadeIn(duration = 500) {
    const h = howlRef.current;
    h.stop();
    h.volume(0);
    h.play();
    h.fade(0, baseVolumeRef.current * volumeMultiplier, duration);
  }

  return { play, stop, fadeOut, fadeIn };
}
