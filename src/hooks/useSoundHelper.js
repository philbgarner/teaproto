import { useEffect } from 'react';
import { useSfx } from './useSfx';
import { useMusic } from './useMusic';
import { useSettings } from '../SettingsContext';

export function useSoundHelper() {
  const { musicVolume, sfxVolume } = useSettings();

  // UI Interaction Sounds
  const buttonClick = useSfx(`${import.meta.env.BASE_URL}sfx/denielcz-immersivecontrol-button-click-sound-463065.mp3`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const uiClick = useSfx(`${import.meta.env.BASE_URL}sfx/freesound_community-ui-click-97915.mp3`, { volume: 0.2, volumeMultiplier: sfxVolume });
  const selectionChanged = useSfx(`${import.meta.env.BASE_URL}sfx/Selection_changed.wav`, { volume: 0.4, volumeMultiplier: sfxVolume });
  const acceptSelection = useSfx(`${import.meta.env.BASE_URL}sfx/accept_selection.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const denySelection = useSfx(`${import.meta.env.BASE_URL}sfx/deny_selection.wav`, { volume: 0.2, volumeMultiplier: sfxVolume });

  // Game Action Sounds
  const lightning = useSfx(`${import.meta.env.BASE_URL}sfx/dragon-studio-lightning-strike-386161.mp3`, { volume: 0.4, volumeMultiplier: sfxVolume });
  const thunder = useSfx(`${import.meta.env.BASE_URL}sfx/tanweraman-thunder-strike-wav-321628.mp3`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const teacup = useSfx(`${import.meta.env.BASE_URL}sfx/teacup-sfx.wav`, { volume: 0.4, volumeMultiplier: sfxVolume });
  const twinkle = useSfx(`${import.meta.env.BASE_URL}sfx/twinkle.wav`, { volume: 0.2, volumeMultiplier: sfxVolume });
  const invert_twinkle = useSfx(`${import.meta.env.BASE_URL}sfx/invert_twinkle.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const tea_ready = useSfx(`${import.meta.env.BASE_URL}sfx/tea_ready.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const beep_failure = useSfx(`${import.meta.env.BASE_URL}sfx/beep_failure.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const trap_armed = useSfx(`${import.meta.env.BASE_URL}sfx/trap_armed.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const coins = useSfx(`${import.meta.env.BASE_URL}sfx/coins.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });

  // Door Sounds
  const doorOpen = useSfx(`${import.meta.env.BASE_URL}sfx/door_open.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const doorClose = useSfx(`${import.meta.env.BASE_URL}sfx/door_closes.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const key_open = useSfx(`${import.meta.env.BASE_URL}sfx/key_turn.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const key_close = useSfx(`${import.meta.env.BASE_URL}sfx/key_lock.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const slideUp = useSfx(`${import.meta.env.BASE_URL}sfx/slide_up.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });
  const slideDown = useSfx(`${import.meta.env.BASE_URL}sfx/slide_down.wav`, { volume: 0.5, volumeMultiplier: sfxVolume });

  // Ambient/Environment Sounds
  const birds = useMusic(`${import.meta.env.BASE_URL}sfx/loswin23-morning-birds-499429.mp3`, { volume: 0.2, loop: true, volumeMultiplier: musicVolume });

  // Music Tracks
  const mainTheme = useMusic(`${import.meta.env.BASE_URL}music/juliush-awakening-chill-out-music-1295.mp3`, { volume: 0.25, loop: true, volumeMultiplier: musicVolume });
  const safeZoneMusic = useMusic(`${import.meta.env.BASE_URL}music/MUS_8_SafeZone_Cozy.ogg`, { volume: 1.0, loop: true, volumeMultiplier: musicVolume });
  const mainThemeDungeon = useMusic(`${import.meta.env.BASE_URL}music/MUS_1_MainTheme_Cozy.ogg`, { volume: 1.0, loop: true, volumeMultiplier: musicVolume });

  // Footsteps
  const footstep_1 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_1.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_2 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_2.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_3 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_3.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_4 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_4.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_5 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_5.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_6 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_6.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_7 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_7.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_8 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_8.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_9 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_9.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });
  const footstep_10 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_10.wav`, { volume: 0.3, volumeMultiplier: sfxVolume });

  const steps = [footstep_1, footstep_2, footstep_3, footstep_4, footstep_5, footstep_6, footstep_7, footstep_8, footstep_9, footstep_10];
  const playRandomFootstep = () => playRandomFromChoices(steps);

  // Talk beeps
  const beep_talk_1 = useSfx(`${import.meta.env.BASE_URL}sfx/beep_talk_1.wav`, { volume: 0.1, volumeMultiplier: sfxVolume });
  const beep_talk_2 = useSfx(`${import.meta.env.BASE_URL}sfx/beep_talk_2.wav`, { volume: 0.1, volumeMultiplier: sfxVolume });
  const beeps = [beep_talk_1, beep_talk_2];
  const playRandomBeep = () => playRandomFromChoices(beeps);

  const playRandomFromChoices = (choices) => {
    const randomChoice = choices[Math.floor(Math.random() * choices.length)];
    randomChoice.play();
  };

  useEffect(() => {
    [birds, mainTheme, safeZoneMusic, mainThemeDungeon].forEach(s => s.setVolume(musicVolume));
  }, [musicVolume]);

  useEffect(() => {
    [
      buttonClick, uiClick, selectionChanged, acceptSelection, denySelection,
      lightning, thunder, teacup, twinkle, invert_twinkle, tea_ready,
      beep_failure, trap_armed, coins, doorOpen, doorClose, key_open, key_close,
      slideUp, slideDown, ...steps, beep_talk_1, beep_talk_2,
    ].forEach(s => s.setVolume(sfxVolume));
  }, [sfxVolume]);

  return {
    sounds: {
      buttonClick,
      uiClick,
      selectionChanged,
      acceptSelection,
      denySelection,
      lightning,
      thunder,
      teacup,
      twinkle,
      invert_twinkle,
      tea_ready,
      beep_failure,
      trap_armed,
      coins,
      doorOpen,
      doorClose,
      key_open,
      key_close,
      slideUp,
      slideDown,
      birds,
      mainTheme,
      safeZoneMusic,
      mainThemeDungeon,
      playRandomFootstep,
      playRandomBeep
    }
  };
}
