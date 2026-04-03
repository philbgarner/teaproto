import { useCallback } from 'react';
import { useSfx } from './useSfx';
import { useMusic } from './useMusic';

/**
 * A comprehensive sound helper that provides easy access to common game sounds
 * and SFX throughout the application. Centralizes sound management and makes
 * it simple to add new sounds to any component.
 * 
 * @returns {Object} Sound helper functions for different game interactions
 */
export function useSoundHelper() {
  // UI Interaction Sounds
  const buttonClick = useSfx(`${import.meta.env.BASE_URL}sfx/denielcz-immersivecontrol-button-click-sound-463065.mp3`, { volume: 0.3 });
  const uiClick = useSfx(`${import.meta.env.BASE_URL}sfx/freesound_community-ui-click-97915.mp3`, { volume: 0.2 });
  const selectionChanged = useSfx(`${import.meta.env.BASE_URL}sfx/Selection_changed.wav`, { volume: 0.4 });
  const acceptSelection = useSfx(`${import.meta.env.BASE_URL}sfx/accept_selection.wav`, { volume: 0.5 });
  const denySelection = useSfx(`${import.meta.env.BASE_URL}sfx/deny_selection.wav`, { volume: 0.2 });
  
  // Game Action Sounds
  const lightning = useSfx(`${import.meta.env.BASE_URL}sfx/dragon-studio-lightning-strike-386161.mp3`, { volume: 0.4 });
  const thunder = useSfx(`${import.meta.env.BASE_URL}sfx/tanweraman-thunder-strike-wav-321628.mp3`, { volume: 0.3 });
  const teacup = useSfx(`${import.meta.env.BASE_URL}sfx/teacup-sfx.wav`, { volume: 0.6 });
  const twinkle = useSfx(`${import.meta.env.BASE_URL}sfx/twinkle.wav`, { volume: 0.3 });
  const invert_twinkle = useSfx(`${import.meta.env.BASE_URL}sfx/invert_twinkle.wav`, { volume: 0.3 });
  const tea_ready = useSfx(`${import.meta.env.BASE_URL}sfx/tea_ready.wav`, { volume: 0.5 });
  const beep_failure = useSfx(`${import.meta.env.BASE_URL}sfx/beep_failure.wav`, { volume: 0.5 });
  const trap_armed = useSfx(`${import.meta.env.BASE_URL}sfx/trap_armed.wav`, { volume: 0.5 });
  
  // Door Sounds
  const doorOpen = useSfx(`${import.meta.env.BASE_URL}sfx/door_open.wav`, { volume: 0.5 });
  const doorClose = useSfx(`${import.meta.env.BASE_URL}sfx/door_closes.wav`, { volume: 0.5 });
  const key_open = useSfx(`${import.meta.env.BASE_URL}sfx/key_turn.wav`, { volume: 0.5 });
  const key_close = useSfx(`${import.meta.env.BASE_URL}sfx/key_lock.wav`, { volume: 0.5 });
  const slideUp = useSfx(`${import.meta.env.BASE_URL}sfx/slide_up.wav`, { volume: 0.5 });
  const slideDown = useSfx(`${import.meta.env.BASE_URL}sfx/slide_down.wav`, { volume: 0.5 });


  // Ambient/Environment Sounds
  const birds = useMusic(`${import.meta.env.BASE_URL}sfx/loswin23-morning-birds-499429.mp3`, { volume: 0.2, loop: true });
  
  // Music Tracks
  const mainTheme = useMusic(`${import.meta.env.BASE_URL}music/juliush-awakening-chill-out-music-1295.mp3`, { volume: 0.25, loop: true });
  const safeZoneMusic = useMusic(`${import.meta.env.BASE_URL}music/MUS_8_SafeZone_Cozy.ogg`, { volume: 1.0, loop: true });
  const mainThemeDungeon = useMusic(`${import.meta.env.BASE_URL}music/MUS_1_MainTheme_Cozy.ogg`, { volume: 1.0, loop: true });

  //footsteps
  const footstep_1 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_1.wav`, { volume: 0.3 });
  const footstep_2 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_2.wav`, { volume: 0.3 });
  const footstep_3 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_3.wav`, { volume: 0.3 });
  const footstep_4 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_4.wav`, { volume: 0.3 });
  const footstep_5 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_5.wav`, { volume: 0.3 });
  const footstep_6 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_6.wav`, { volume: 0.3 });
  const footstep_7 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_7.wav`, { volume: 0.3 });
  const footstep_8 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_8.wav`, { volume: 0.3 });
  const footstep_9 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_9.wav`, { volume: 0.3 });
  const footstep_10 = useSfx(`${import.meta.env.BASE_URL}sfx/footstep_10.wav`, { volume: 0.3 });

  const steps = [footstep_1, footstep_2, footstep_3, footstep_4, footstep_5, footstep_6, footstep_7, footstep_8, footstep_9, footstep_10];
  const playRandomFootstep = () => {
    const randomStep = steps[Math.floor(Math.random() * steps.length)];
    randomStep.play();
  };
  return {
    // Direct access to sound objects if needed
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
      playRandomFootstep
    }
  };
}
