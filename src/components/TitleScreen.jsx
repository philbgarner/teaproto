import { useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense } from "react";
import { useSfx } from "../hooks/useSfx";
import { useMusic } from "../hooks/useMusic";
import { useSettings } from "../SettingsContext";
import SettingsTabs from "../SettingsTabs";
import styles from "./styles/TitleScreen.module.css";

const BASE = import.meta.env.BASE_URL;
const T = (name) => `${BASE}textures/title/${name}.png`;

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

// All texture paths — preloaded as a batch. Index maps to `ti` in layer defs.
const ALL_TEXTURE_PATHS = [
  T("sky_dark"), // 0
  T("sky_lite"), // 1
  T("layer1_lightning_shadow"), // 2
  T("layer4_lightning"), // 3
  T("layer2_back_hill_dark"), // 4
  T("layer2_back_hill_lite"), // 5
  T("layer3_blackcloud1"), // 6
  T("layer3_blackcloud2"), // 7
  T("layer5_graycloud1"), // 8
  T("layer5_graycloud2"), // 9
  T("layer5_whitecloud1"), // 10
  T("layer5_whitecloud2"), // 11
  T("layer6_hill_dark"), // 12
  T("layer6_hill_lite"), // 13
  T("layer7_castle_dark"), // 14
  T("layer7_castle_lite"), // 15
  T("lightning_flash_bkground"), // 16
  T("lightning_flash_foreground"), // 17
  T("title_dark"), // 18
  T("title_lite"), // 19
  T("flower_sprite"), // 20
];

// ─── Timing ───────────────────────────────────────────────────────────────────

const T_SKY = 0.0;
const T_BACKHILL = 0.5;
const SLIDE_DUR = 0.9;
const T_FC = 1.2; // front hill + castle, settled at T_FC + SLIDE_DUR = 2.1s

const T_FLASH = 2.9;

const S1_BOLT_ON = 0.0;
const S1_BOLT_OFF = 0.2;
const S1_FB_ON = 0.35;
const S1_FG_ON = 0.5;
const S1_OFF = 0.6;

const S2_BOLT_ON = 1.1;
const S2_BOLT_OFF = 1.3;
const S2_FB_ON = 1.45;
const S2_FG_ON = 1.6;
const S2_OFF = 1.7;

const T_FLASH_END = T_FLASH + S2_OFF; // 4.2s

const T_LITE = T_FLASH_END + 1.3; // sit dark for 1s, then lite crossfade begins
const DUR_LITE = 0.5;

const T_TITLE = T_FLASH_END + 1.3 + 0.5 + 0.6; // After lite transition and some delay
const DUR_TITLE = 0.9;

// White clouds drift in after castle has settled
const T_WCLOUD1 = T_TITLE + DUR_TITLE + 0.5; // After title and castle are fully visible
const T_WCLOUD2 = T_WCLOUD1 + 0.35;
const DUR_WCLOUD_FADE = 0.5;

// Flowers appear with white clouds
const T_FLOWERS = T_WCLOUD1; // Same time as first white cloud
const DUR_FLOWER_FADE = 0.5;

const MENU_SHOW_T = T_WCLOUD2 + 0.6; // Updated to after white clouds
const CASTLE_SLIDE_DUR = 0.9;

// IDs of dark layers that fade OUT as lite fades IN
const DARK_LAYER_IDS = new Set([
  "sky_d",
  "bhill_d",
  "fhill_d",
  "cast_d",
  "title_d",
]);

// ─── Static layer sequence ────────────────────────────────────────────────────
// Render order: 0-1 sky, 2-3 storm clouds (behind hills), 4-5 back hill,
// 6 white clouds (behind front hill), 7-8 front hill, 9-10 castle, 11 flowers,
// 12 title, 15 bolt, 20-21 flash masks

const SEQUENCE = [
  { id: "sky_d", ti: 0, ro: 0, start: T_SKY, dur: 0.8, anim: "fadeIn" },
  {
    id: "bhill_d",
    ti: 4,
    ro: 4,
    start: T_BACKHILL,
    dur: SLIDE_DUR,
    anim: "slideUp",
  },
  {
    id: "fhill_d",
    ti: 12,
    ro: 7,
    start: T_FC,
    dur: SLIDE_DUR,
    anim: "slideUp",
  },
  { id: "cast_d", ti: 14, ro: 9, start: T_FC, dur: SLIDE_DUR, anim: "slideUp" },
  {
    id: "title_d",
    ti: 18,
    ro: 11,
    start: T_FC,
    dur: SLIDE_DUR,
    anim: "slideUp",
  },
  { id: "sky_l", ti: 1, ro: 1, start: T_LITE, dur: DUR_LITE, anim: "fadeIn" },
  { id: "bhill_l", ti: 5, ro: 5, start: T_LITE, dur: DUR_LITE, anim: "fadeIn" },
  {
    id: "fhill_l",
    ti: 13,
    ro: 8,
    start: T_LITE,
    dur: DUR_LITE,
    anim: "fadeIn",
  },
  {
    id: "cast_l",
    ti: 15,
    ro: 10,
    start: T_LITE,
    dur: DUR_LITE,
    anim: "fadeIn",
  },
  { id: "title", ti: 19, ro: 12, start: T_LITE, dur: DUR_LITE, anim: "fadeIn" },
];

// ─── Marionette cloud system ──────────────────────────────────────────────────
// Each "jerk" entry: [t_arrive, x_fraction]
// x_fraction is relative to viewport width (0=centre, 1=one full width right).
// The cloud quick-slides to each position in JERK_DUR seconds, then holds still
// until the next one — like a stage flat being jerked along a wire.

const JERK_DUR = 0.1; // seconds per jerk slide

// Returns x position in world units for a cloud at scene-time t.
// When loop=true the sequence repeats forever; first and last positions
// must match so the wrap is seamless.
// Clouds drift linearly between positions instead of instant movement.
function driftX(t, positions, W, loop = false) {
  if (!positions.length) return 0;
  let effectiveT = t;
  if (loop && positions.length > 1) {
    const t0 = positions[0][0];
    const period = positions[positions.length - 1][0] - t0;
    if (period > 0 && t > t0) effectiveT = t0 + ((t - t0) % period);
  }
  if (effectiveT < positions[0][0]) return positions[0][1] * W;

  for (let i = 1; i < positions.length; i++) {
    const [currT, currX] = positions[i];
    const [prevT, prevX] = positions[i - 1];
    const targetX = currX * W;
    const startX = prevX * W;

    if (effectiveT < currT) {
      // Linear interpolation between previous and current position
      const p = (effectiveT - prevT) / (currT - prevT);
      return startX + (targetX - startX) * p;
    }
  }

  // Return last position if beyond the sequence
  return positions[positions.length - 1][1] * W;
}

// Storm clouds — drift linearly between positions.
// x values are absolute fractions of viewport width (0 = centre), staying small
// so each cloud drifts ±0.05–0.12 around its home position.
// Dark underlayer (ro 2) and gray overlay (ro 3) have different timing
// so the two layers move independently and create a sense of depth.
// Gray clouds follow dark clouds with a delay.
const STORM_CLOUD_DELAY = 0.3; // Gray clouds follow dark clouds by this delay

const STORM_CLOUD_DEFS = [
  // ── Dark/black underlayer — slower, broader movements ─────────
  {
    id: "dc0",
    ti: 6,
    ro: 2,
    yFac: 0.43,
    positions: [
      [0.0, -0.2],
      [1.3, -0.1],
      [2.5, -0.23],
      [3.8, -0.12],
      [5.1, -0.2],
    ],
  },
  {
    id: "dc1",
    ti: 7,
    ro: 2,
    yFac: 0.47,
    positions: [
      [0.0, 0.22],
      [1.5, 0.11],
      [2.8, 0.25],
      [4.1, 0.14],
      [5.4, 0.22],
    ],
  },
  {
    id: "dc2",
    ti: 6,
    ro: 2,
    yFac: 0.39,
    positions: [
      [0.0, -0.04],
      [1.1, -0.15],
      [2.3, -0.02],
      [3.5, -0.13],
      [4.8, -0.05],
    ],
  },
  {
    id: "dc3",
    ti: 7,
    ro: 2,
    yFac: 0.41,
    positions: [
      [0.0, 0.36],
      [1.4, 0.26],
      [2.7, 0.38],
      [4.0, 0.28],
      [5.3, 0.36],
    ],
  },
  // ── Gray overlay — follows dark clouds with delay ─
  {
    id: "gc0",
    ti: 8,
    ro: 3,
    yFac: 0.3,
    positions: [
      [0.0, 0.12],
      [0.9, 0.22],
      [1.8, 0.08],
      [2.7, 0.19],
      [3.6, 0.07],
      [4.5, 0.17],
    ],
  },
  {
    id: "gc1",
    ti: 9,
    ro: 3,
    yFac: 0.34,
    positions: [
      [0.0, -0.28],
      [0.7, -0.16],
      [1.6, -0.3],
      [2.5, -0.18],
      [3.4, -0.26],
      [4.3, -0.14],
    ],
  },
  {
    id: "gc2",
    ti: 8,
    ro: 3,
    yFac: 0.26,
    positions: [
      [0.0, 0.28],
      [1.0, 0.16],
      [2.0, 0.3],
      [3.0, 0.18],
      [4.0, 0.27],
    ],
  },
  {
    id: "gc3",
    ti: 9,
    ro: 3,
    yFac: 0.37,
    positions: [
      [0.0, -0.1],
      [0.8, -0.21],
      [1.7, -0.06],
      [2.6, -0.19],
      [3.5, -0.08],
      [4.4, -0.2],
    ],
  },
];

// White clouds — gentle independent drift in the cleared lite sky.
// Each has a dark underlayer (darkTi) that follows the same movement sequence
// but delayed by LITE_FOLLOW_DELAY seconds, so it lags then catches up.
const LITE_FOLLOW_DELAY = 0.5;

// Flowers — appear with white clouds and turn continuously
const FLOWER_DEFS = [
  {
    id: "flower0",
    ti: 20, // flower_sprite texture index
    ro: 13, // render order - in front of most elements
    xFac: -0.46, // horizontal position as fraction of viewport width
    yFac: -0.22, // vertical position as fraction of viewport height (moved down)
    scale: 0.8, // size multiplier
    rotationSpeed: 0.5, // radians per second
    pulseFrequency: 0.12, // Hz - slowest pulsing
    startDelay: 0.0, // delay before this flower starts appearing
  },
  {
    id: "flower1",
    ti: 20,
    ro: 13,
    xFac: -0.35,
    yFac: -0.42,
    scale: 1.0,
    rotationSpeed: -0.4,
    pulseFrequency: 0.25, // Hz
    startDelay: 0.6,
  },
  {
    id: "flower2",
    ti: 20,
    ro: 13,
    xFac: -0.17,
    yFac: -0.26,
    scale: 1.4,
    rotationSpeed: -0.3,
    pulseFrequency: 0.4, // Hz
    startDelay: 0.4,
  },
  {
    id: "flower3",
    ti: 20,
    ro: 13,
    xFac: -0.04,
    yFac: -0.12,
    scale: 1.1,
    rotationSpeed: 0.6,
    pulseFrequency: 0.5, // Hz
    startDelay: 0.8,
  },
  {
    id: "flower4",
    ti: 20,
    ro: 13,
    xFac: 0.06,
    yFac: -0.28,
    scale: 0.8,
    rotationSpeed: -0.7, // counter-clockwise
    pulseFrequency: 0.6, // Hz - fastest pulsing
    startDelay: 0.2,
  },
];

const LITE_CLOUD_DEFS = [
  {
    id: "wc0",
    ti: 10,
    darkTi: 8,
    ro: 6,
    yFac: 0.42,
    startT: T_WCLOUD1,
    loop: true,
    positions: [
      [T_WCLOUD1, 0.06],
      [T_WCLOUD1 + 2.8, 0.02],
      [T_WCLOUD1 + 5.5, 0.07],
      [T_WCLOUD1 + 8.2, 0.06],
    ],
  },
  {
    id: "wc1",
    ti: 11,
    darkTi: 9,
    ro: 6,
    yFac: 0.34,
    startT: T_WCLOUD2,
    loop: true,
    positions: [
      [T_WCLOUD2, -0.07],
      [T_WCLOUD2 + 3.1, -0.03],
      [T_WCLOUD2 + 6.0, -0.08],
      [T_WCLOUD2 + 9.0, -0.07],
    ],
  },
];

// ─── Inner scene ──────────────────────────────────────────────────────────────

function SceneContent({
  textures,
  onMenuReady,
  playLightningStrike,
  playThunderStrike,
  playMusic,
  playBirds,
  skipRef,
}) {
  const { viewport } = useThree();
  const refs = useRef({});
  const startT = useRef(null);
  const menuFired = useRef(false);
  const menuFiredT = useRef(null);
  const boltWasOn = useRef(false);
  const musicFired = useRef(false);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (startT.current === null) startT.current = now;
    if (skipRef?.current && !menuFired.current) {
      startT.current = now - MENU_SHOW_T;
    }
    const t = now - startT.current;
    const { width: W, height: H } = viewport;

    // ── Static/sequenced layers ───────────────────────────────────────────────
    for (const { id, start, dur, anim } of SEQUENCE) {
      const mesh = refs.current[id];
      if (!mesh) continue;
      const raw = Math.min(1, Math.max(0, (t - start) / dur));
      const p = easeOut(raw);
      switch (anim) {
        case "fadeIn":
          mesh.material.opacity = p;
          break;
        case "slideUp":
          mesh.material.opacity = Math.min(1, raw * 2.5);
          mesh.position.y = (1 - p) * -H * 0.5;
          break;
      }
    }

    // ── Fade dark layers out as lite fades in ─────────────────────────────────
    if (t >= T_LITE) {
      for (const id of DARK_LAYER_IDS) {
        const mesh = refs.current[id];
        if (!mesh) continue;
        mesh.material.opacity =
          1 - easeOut(Math.min(1, (t - T_LITE) / DUR_LITE));
      }
    }

    // ── Storm clouds — dark clouds drift, gray clouds follow with delay ──────────
    // Storm clouds fade out after lite transition, before castle appears
    let stormCloudOpacity;
    if (t < T_LITE + DUR_LITE) {
      stormCloudOpacity = 0.8; // Fully visible during dark phase
    } else {
      // Start fading out immediately after lite transition completes
      const fadeProgress = Math.min(1, (t - (T_LITE + DUR_LITE)) / 2.0);
      stormCloudOpacity = 0.8 * (1 - fadeProgress);
    }

    for (const cloudDef of STORM_CLOUD_DEFS) {
      const mesh = refs.current[cloudDef.id];
      if (!mesh) continue;
      mesh.position.y = H * cloudDef.yFac;

      if (cloudDef.positions) {
        // Dark cloud - moves independently
        mesh.position.x = driftX(t, cloudDef.positions, W);
        mesh.material.opacity = stormCloudOpacity;
      } else if (cloudDef.followTarget && cloudDef.followDelay) {
        // Gray cloud - follows dark clouzd with delay
        const targetCloud = STORM_CLOUD_DEFS.find(
          (c) => c.id === cloudDef.followTarget,
        );
        if (targetCloud && targetCloud.positions) {
          const delayedT = Math.max(0, t - cloudDef.followDelay);
          mesh.position.x = driftX(delayedT, targetCloud.positions, W);
          mesh.material.opacity = stormCloudOpacity * 0.75; // Slightly more transparent
        }
      }
    }

    // ── White clouds + dark underlayers ──────────────────────────────────────
    for (const { id, positions, yFac, startT: st, loop } of LITE_CLOUD_DEFS) {
      const mesh = refs.current[id];
      const darkMesh = refs.current[id + "_dark"];
      if (!mesh) continue;
      mesh.position.y = H * yFac;
      if (darkMesh) darkMesh.position.y = H * yFac;
      if (t < st) {
        mesh.material.opacity = 0;
        if (darkMesh) darkMesh.material.opacity = 0;
        continue;
      }

      // White clouds fade in faster over 1 second
      const fadeInProgress = Math.min(1, (t - st) / 1.0);
      const opacity = easeOut(fadeInProgress);

      mesh.position.x = driftX(t, positions, W, loop);
      mesh.material.opacity = opacity;

      // Dark underlayer evaluates the same sequence but LITE_FOLLOW_DELAY behind,
      // clamped to startT so it doesn't evaluate before the cloud exists.
      if (darkMesh) {
        darkMesh.position.x = driftX(
          Math.max(st, t - LITE_FOLLOW_DELAY),
          positions,
          W,
          loop,
        );
        darkMesh.material.opacity = opacity * 0.3;
      }
    }

    // ── Flowers — appear with white clouds and turn continuously ─────────────
    for (const {
      id,
      xFac,
      yFac,
      scale,
      rotationSpeed,
      pulseFrequency,
      startDelay,
    } of FLOWER_DEFS) {
      const mesh = refs.current[id];
      if (!mesh) continue;

      const flowerStartT = T_FLOWERS + startDelay;
      mesh.position.x = W * xFac;
      mesh.position.y = H * yFac;

      // Scale pulsing between 0.9 and 1.1 at flower-specific frequency
      const pulseTime = t - flowerStartT;
      const pulseFactor =
        1.0 + 0.1 * Math.sin(2 * Math.PI * pulseFrequency * pulseTime);
      const actualScale = scale * pulseFactor;
      mesh.scale.set(actualScale * W, actualScale * W, 1);

      if (t < flowerStartT) {
        mesh.material.opacity = 0;
        mesh.rotation.z = 0;
        continue;
      }

      const opacity = easeOut(
        Math.min(1, (t - flowerStartT) / DUR_FLOWER_FADE),
      );
      mesh.material.opacity = opacity;
      mesh.rotation.z = (t - flowerStartT) * rotationSpeed;
    }

    // ── Music ─────────────────────────────────────────────────────────────────
    if (!musicFired.current && t >= T_LITE) {
      musicFired.current = true;
      playMusic();
      playBirds();
    }

    // ── Lightning flash — binary on/off ───────────────────────────────────────
    const boltMesh = refs.current["bolt"];
    const fbMesh = refs.current["flash_bg"];
    const ffMesh = refs.current["flash_fg"];

    const boltOn =
      (t >= T_FLASH + S1_BOLT_ON && t < T_FLASH + S1_BOLT_OFF) ||
      (t >= T_FLASH + S2_BOLT_ON && t < T_FLASH + S2_BOLT_OFF);
    const fbOn =
      (t >= T_FLASH + S1_FB_ON && t < T_FLASH + S1_OFF) ||
      (t >= T_FLASH + S2_FB_ON && t < T_FLASH + S2_OFF);
    const ffOn =
      (t >= T_FLASH + S1_FG_ON && t < T_FLASH + S1_OFF) ||
      (t >= T_FLASH + S2_FG_ON && t < T_FLASH + S2_OFF);

    if (boltOn && !boltWasOn.current) {
      playLightningStrike();
      playThunderStrike();
    }
    boltWasOn.current = boltOn;

    if (boltMesh) boltMesh.material.opacity = boltOn ? 1 : 0;
    if (fbMesh) fbMesh.material.opacity = fbOn ? 1 : 0;
    if (ffMesh) ffMesh.material.opacity = ffOn ? 1 : 0;

    // ── Castle + front hill parallax — slide left when menu fires ───────────────
    if (menuFiredT.current !== null) {
      const p = easeOut(
        Math.min(1, (t - menuFiredT.current) / CASTLE_SLIDE_DUR),
      );
      const slideX = -W * 0.26 * p;
      for (const id of ["cast_d", "cast_l", "fhill_d", "fhill_l"]) {
        const mesh = refs.current[id];
        if (mesh) mesh.position.x = slideX;
      }
    }

    // ── Menu ready ────────────────────────────────────────────────────────────
    if (!menuFired.current && t >= MENU_SHOW_T) {
      menuFired.current = true;
      menuFiredT.current = t;
      onMenuReady();
    }
  });

  const { width: w, height: h } = viewport;

  const fullMesh = (id, ti, ro) => (
    <mesh
      key={id}
      renderOrder={ro}
      ref={(m) => {
        if (m) refs.current[id] = m;
      }}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={textures[ti]}
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );

  const flowerMesh = (id, ti, ro) => (
    <mesh
      key={id}
      renderOrder={ro}
      ref={(m) => {
        if (m) refs.current[id] = m;
      }}
    >
      <planeGeometry args={[w * 0.00002, w * 0.00002]} />
      <meshBasicMaterial
        map={textures[ti]}
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
  console.log("Title Screen Mount");
  return (
    <>
      {/* Static sequence layers */}
      {SEQUENCE.map(({ id, ti, ro }) => fullMesh(id, ti, ro))}

      {/* Storm clouds — two layers, both behind hills */}
      {STORM_CLOUD_DEFS.map(({ id, ti, ro }) => fullMesh(id, ti, ro))}

      {/* Dark underlayers for lite clouds — same ro, drawn first so white is on top */}
      {LITE_CLOUD_DEFS.map(({ id, darkTi, ro }) =>
        fullMesh(id + "_dark", darkTi, ro),
      )}
      {/* White clouds — lite sky */}
      {LITE_CLOUD_DEFS.map(({ id, ti, ro }) => fullMesh(id, ti, ro))}

      {/* Flowers — appear with white clouds */}
      {FLOWER_DEFS.map(({ id, ti, ro }) => flowerMesh(id, ti, ro))}

      {/* Lightning bolt — visible briefly before each screen flash */}
      {fullMesh("bolt", 3, 15)}
      {/* Full-screen flash frames */}
      {fullMesh("flash_bg", 16, 20)}
      {fullMesh("flash_fg", 17, 21)}
    </>
  );
}

function PreloadedScene({ onMenuReady, onMusicReady, skipRef }) {
  const textures = useTexture(ALL_TEXTURE_PATHS);
  const { play: playLightningStrike } = useSfx(
    `${BASE}sfx/dragon-studio-lightning-strike-386161.mp3`,
    0.25,
  );
  const { play: playThunderStrike } = useSfx(
    `${BASE}sfx/tanweraman-thunder-strike-wav-321628.mp3`,
    0.25,
  );
  const { play: playMusic, fadeOut: fadeOutMusic } = useMusic(
    `${BASE}music/juliush-awakening-chill-out-music-1295.mp3`,
    { loop: true, volume: 0.25 },
  );
  const { play: playBirds, fadeOut: fadeOutBirds } = useSfx(
    `${BASE}sfx/loswin23-morning-birds-499429.mp3`,
    0.2,
  );
  const { fadeIn: fadeInSafeZone } = useMusic(
    `${BASE}music/MUS_8_SafeZone_Cozy.ogg`,
    { loop: true },
    1.0,
  );

  useEffect(() => {
    onMusicReady({ fadeOutMusic, fadeOutBirds, fadeInSafeZone });
  }, []);

  return (
    <SceneContent
      textures={textures}
      onMenuReady={onMenuReady}
      playLightningStrike={playLightningStrike}
      playThunderStrike={playThunderStrike}
      playMusic={playMusic}
      playBirds={playBirds}
      skipRef={skipRef}
    />
  );
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

function MenuItem({ label, onClick }) {
  return (
    <button className={styles.menuItem} onClick={onClick}>
      {label}
    </button>
  );
}

// ─── Difficulty presets ───────────────────────────────────────────────────────

const DIFFICULTY_PRESETS = {
  easy: {
    tempDropPerStep: 0.5,
    heatingPerStep: 6.0,
    satiationDropPerStep: 0.1,
    supersatiationBonus: 50,
    turnsPerWave: 120,
    traversalFactor: 2.0,
    adventurerDreadRate: 0.5,
    adventurerLootPerChest: 20,
  },
  normal: {
    tempDropPerStep: 1.0,
    heatingPerStep: 3.5,
    satiationDropPerStep: 0.3,
    supersatiationBonus: 25,
    turnsPerWave: 60,
    traversalFactor: 1.0,
    adventurerDreadRate: 1.5,
    adventurerLootPerChest: 10,
  },
  hard: {
    tempDropPerStep: 2.0,
    heatingPerStep: 1.5,
    satiationDropPerStep: 0.6,
    supersatiationBonus: 10,
    turnsPerWave: 30,
    traversalFactor: 0.5,
    adventurerDreadRate: 3.0,
    adventurerLootPerChest: 5,
  },
};

// ─── Root component ───────────────────────────────────────────────────────────

export function TitleScreen({ onNewGame }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuFading, setMenuFading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [choosingDifficulty, setChoosingDifficulty] = useState(false);
  const musicRef = useRef({});
  const skipRef = useRef(false);
  const settings = useSettings();

  function handleNewGame() {
    if (menuFading) return;
    setChoosingDifficulty(true);
  }

  function handleDifficulty(level) {
    if (menuFading) return;
    const preset = DIFFICULTY_PRESETS[level];
    settings.setTempDropPerStep(preset.tempDropPerStep);
    settings.setHeatingPerStep(preset.heatingPerStep);
    settings.setSatiationDropPerStep(preset.satiationDropPerStep);
    settings.setSupersatiationBonus(preset.supersatiationBonus);
    settings.setTurnsPerWave(preset.turnsPerWave);
    settings.setTraversalFactor(preset.traversalFactor);
    settings.setAdventurerDreadRate(preset.adventurerDreadRate);
    settings.setAdventurerLootPerChest(preset.adventurerLootPerChest);
    setMenuFading(true);
    const FADE = 600;
    musicRef.current.fadeOutMusic?.(FADE);
    musicRef.current.fadeOutBirds?.(FADE);
    setTimeout(() => musicRef.current.fadeInSafeZone?.(FADE), FADE);
    setTimeout(onNewGame, FADE * 2);
  }

  function handleSkip() {
    if (!menuVisible) skipRef.current = true;
  }

  return (
    <div className={styles.root} onClick={handleSkip}>
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 100] }}
        className={styles.canvas}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <PreloadedScene
            onMenuReady={() => setMenuVisible(true)}
            onMusicReady={(fns) => {
              musicRef.current = fns;
            }}
            skipRef={skipRef}
          />
        </Suspense>
      </Canvas>

      <div
        className={styles.menu}
        style={{
          opacity: menuVisible && !menuFading ? 1 : 0,
          transition: menuVisible ? "opacity 0.55s ease-out" : "none",
          pointerEvents: menuVisible && !menuFading ? "auto" : "none",
        }}
      >
        {!choosingDifficulty ? (
          <>
            <MenuItem label="New Game" onClick={handleNewGame} />
            <MenuItem label="Settings" onClick={() => setShowSettings(true)} />
            <MenuItem label="Credits" />
          </>
        ) : (
          <>
            <MenuItem label="Easy" onClick={() => handleDifficulty("easy")} />
            <MenuItem
              label="Normal"
              onClick={() => handleDifficulty("normal")}
            />
            <MenuItem label="Hard" onClick={() => handleDifficulty("hard")} />
          </>
        )}
      </div>

      {showSettings && (
        <div
          className={styles.settingsOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className={styles.settingsPanel}>
            <div className={styles.settingsPanelHeader}>
              <span className={styles.settingsPanelTitle}>Settings</span>
              <button
                className={styles.settingsPanelClose}
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.settingsPanelBody}>
              <SettingsTabs {...settings} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
