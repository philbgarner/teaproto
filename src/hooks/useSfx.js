import { useRef, useEffect } from "react";
import { Howl } from "howler";

export function useSfx(src, { volume = 1.0, volumeMultiplier = 1.0 } = {}) {
  const baseVolumeRef = useRef(volume);
  const howlRef = useRef(null);
  if (howlRef.current === null) {
    howlRef.current = new Howl({ src: [src], volume: volume * volumeMultiplier });
  }

  useEffect(() => {
    howlRef.current.volume(baseVolumeRef.current * volumeMultiplier);
  }, [volumeMultiplier]);

  function play() {
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

  function setVolume(multiplier) {
    howlRef.current.volume(baseVolumeRef.current * multiplier);
  }

  return { play, stop, fadeOut, setVolume };
}
