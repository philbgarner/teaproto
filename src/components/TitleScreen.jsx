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

const T_FLASH = 2.5;

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

const T_LITE = T_FLASH_END + 0.3; // 4.5s — lite crossfade begins
const DUR_LITE = 0.5;

// White clouds drift in after sky has cleared
const T_WCLOUD1 = T_LITE + DUR_LITE + 0.3; // 5.3s
const T_WCLOUD2 = T_WCLOUD1 + 0.35; // 5.65s
const DUR_WCLOUD_FADE = 0.5;

const T_TITLE = T_WCLOUD2 + 0.6; // 6.25s
const DUR_TITLE = 0.9;

const MENU_SHOW_T = T_TITLE + DUR_TITLE + 0.3; // 7.45s
const CASTLE_SLIDE_DUR = 0.9;

// IDs of dark layers that fade OUT as lite fades IN
const DARK_LAYER_IDS = new Set(["sky_d", "bhill_d", "fhill_d", "cast_d"]);

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
  {
    id: "title",
    ti: 19,
    ro: 12,
    start: T_TITLE,
    dur: DUR_TITLE,
    anim: "slideUp",
  },
];

// ─── Marionette cloud system ──────────────────────────────────────────────────
// Each "jerk" entry: [t_arrive, x_fraction]
// x_fraction is relative to viewport width (0=centre, 1=one full width right).
// The cloud quick-slides to each position in JERK_DUR seconds, then holds still
// until the next one — like a stage flat being jerked along a wire.

const JERK_DUR = 0.1; // seconds per jerk slide

// Returns x position in world units for a cloud at scene-time t.
// When loop=true the sequence repeats forever; first and last jerk positions
// must match so the wrap is seamless.
function jerkX(t, jerks, W, loop = false) {
  if (!jerks.length) return 0;
  let effectiveT = t;
  if (loop && jerks.length > 1) {
    const t0 = jerks[0][0];
    const period = jerks[jerks.length - 1][0] - t0;
    if (period > 0 && t > t0) effectiveT = t0 + ((t - t0) % period);
  }
  if (effectiveT < jerks[0][0]) return jerks[0][1] * W;
  let prevX = jerks[0][1] * W;
  for (let i = 1; i < jerks.length; i++) {
    const [jt, jx] = jerks[i];
    const targetX = jx * W;
    if (effectiveT < jt) {
      const slideStart = jt - JERK_DUR;
      if (effectiveT >= slideStart) {
        const p = (effectiveT - slideStart) / JERK_DUR;
        return prevX + (targetX - prevX) * easeOut(p);
      }
      return prevX;
    }
    prevX = targetX;
  }
  return prevX;
}

// Storm clouds — wiggle in place (puppet theater: jerky but not drifting).
// x values are absolute fractions of viewport width (0 = centre), staying small
// so each cloud wiggles ±0.05–0.12 around its home position.
// Dark underlayer (ro 2) and gray overlay (ro 3) have different jerk intervals
// so the two layers move independently and create a sense of depth.
const STORM_CLOUD_DEFS = [
  // ── Dark/black underlayer — heavier beat, ~1.2–1.5 s between jerks ─────────
  {
    id: "dc0",
    ti: 6,
    ro: 2,
    yFac: 0.43,
    jerks: [
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
    jerks: [
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
    jerks: [
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
    jerks: [
      [0.0, 0.36],
      [1.4, 0.26],
      [2.7, 0.38],
      [4.0, 0.28],
      [5.3, 0.36],
    ],
  },
  // ── Gray overlay — lighter beat, ~0.8–1.0 s between jerks, different phase ─
  {
    id: "gc0",
    ti: 8,
    ro: 3,
    yFac: 0.3,
    jerks: [
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
    jerks: [
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
    jerks: [
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
    jerks: [
      [0.0, -0.1],
      [0.8, -0.21],
      [1.7, -0.06],
      [2.6, -0.19],
      [3.5, -0.08],
      [4.4, -0.2],
    ],
  },
];

// White clouds — gentle independent wiggle in the cleared lite sky.
// Each has a dark underlayer (darkTi) that follows the same jerk sequence
// but delayed by LITE_FOLLOW_DELAY seconds, so it lags then catches up.
const LITE_FOLLOW_DELAY = 0.5;

const LITE_CLOUD_DEFS = [
  {
    id: "wc0",
    ti: 10,
    darkTi: 8,
    ro: 6,
    yFac: 0.42,
    startT: T_WCLOUD1,
    loop: true,
    jerks: [
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
    jerks: [
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

    // ── Storm clouds — wiggle in place, fade in with sky, fade out at T_LITE ───
    for (const { id, jerks, yFac } of STORM_CLOUD_DEFS) {
      const mesh = refs.current[id];
      if (!mesh) continue;
      mesh.position.x = jerkX(t, jerks, W);
      mesh.position.y = H * yFac;
      if (t < 0.8) {
        mesh.material.opacity = easeOut(t / 0.8);
      } else if (t >= T_LITE) {
        mesh.material.opacity = Math.max(
          0,
          1 - easeOut((t - T_LITE) / DUR_LITE),
        );
      } else {
        mesh.material.opacity = 1;
      }
    }

    // ── White clouds + dark underlayers ──────────────────────────────────────
    for (const { id, jerks, yFac, startT: st, loop } of LITE_CLOUD_DEFS) {
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
      const opacity = easeOut(Math.min(1, (t - st) / DUR_WCLOUD_FADE));
      mesh.position.x = jerkX(t, jerks, W, loop);
      mesh.material.opacity = opacity;
      // Dark underlayer evaluates the same sequence but LITE_FOLLOW_DELAY behind,
      // clamped to startT so it doesn't evaluate before the cloud exists.
      if (darkMesh) {
        darkMesh.position.x = jerkX(
          Math.max(st, t - LITE_FOLLOW_DELAY),
          jerks,
          W,
          loop,
        );
        darkMesh.material.opacity = opacity * 0.3;
      }
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

// ─── Root component ───────────────────────────────────────────────────────────

export function TitleScreen({ onNewGame }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuFading, setMenuFading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const musicRef = useRef({});
  const skipRef = useRef(false);
  const settings = useSettings();

  useEffect(() => {
    const face = new FontFace(
      "Maison Neue",
      `url('${BASE}fonts/MaisonNeue.ttf') format('truetype')`,
    );
    face
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => {});
  }, []);

  function handleNewGame() {
    if (menuFading) return;
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
        <MenuItem label="New Game" onClick={handleNewGame} />
        <MenuItem label="Settings" onClick={() => setShowSettings(true)} />
        <MenuItem label="Credits" />
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
