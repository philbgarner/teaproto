import { useState, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Suspense } from "react";
import { useSfx } from "../hooks/useSfx";
import { useMusic } from "../hooks/useMusic";
import styles from "./styles/TitleScreen.module.css";

const BASE = import.meta.env.BASE_URL;
const T = (name) => `${BASE}textures/title/${name}.png`;

function easeOut(t) {
  return 1 - (1 - t) ** 3;
}

// Elastic overshoot — cloud overshoots target and springs back.
function easeOutElastic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// All texture paths — preloaded as a batch. Order maps to `ti` in SEQUENCE.
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
// Front hill + castle start together and arrive together.
const T_FC = 1.2; // → both settled at T_FC + SLIDE_DUR = 2.1s

// Lightning flash starts 0.4s after the dark scene has settled.
const T_FLASH = 2.5;

// Named offsets from T_FLASH for each event (seconds).
// Strike 1: bolt 200ms → 150ms pause → flash_bg 250ms (fg overlays last 100ms)
const S1_BOLT_ON = 0.0;
const S1_BOLT_OFF = 0.2;
const S1_FB_ON = 0.35; // 150ms dark pause after bolt
const S1_FG_ON = 0.5; // fg overlays the last 100ms of the bg flash
const S1_OFF = 0.6; // everything off

// 500ms breathing space between strikes
// Strike 2: same pattern
const S2_BOLT_ON = 1.1;
const S2_BOLT_OFF = 1.3;
const S2_FB_ON = 1.45;
const S2_FG_ON = 1.6;
const S2_OFF = 1.7;

const T_FLASH_END = T_FLASH + S2_OFF; // 4.2s

// Lite cross-fade begins after a 300ms pause following the last flash.
const T_LITE = T_FLASH_END + 0.3; // 4.5s
const DUR_LITE = 0.5;

// Clouds drop in once the lite scene is fully visible.
const T_CLOUD1 = T_LITE + DUR_LITE + 0.1; // ~4.0s
const T_CLOUD2 = T_CLOUD1 + 0.15; // ~4.15s
const DUR_CLOUD = 0.45;

// Cloud resting Y: shift the plane centre up so the cloud shapes appear near
// the top of the screen.  With zoom=1 the plane centre at +0.5×H sits at the
// very top edge of the viewport; the cloud shapes (which live in the lower
// portion of the image) then appear in roughly the top 15% of the screen.
const CLOUD_REST_Y_FACTOR = 0.5; // multiplied by viewport.height each frame

const T_TITLE = T_CLOUD2 + DUR_CLOUD + 0.2; // ~4.8s
const DUR_TITLE = 0.9;

const MENU_SHOW_T = T_TITLE + DUR_TITLE + 0.3; // ~6.0s

// IDs of dark layers that must fade OUT as the lite scene fades in.
const DARK_LAYER_IDS = new Set(["sky_d", "bhill_d", "fhill_d", "cast_d"]);

// ─── Layer definitions ────────────────────────────────────────────────────────

const SEQUENCE = [
  // Dark scene build-up
  { id: "sky_d", ti: 0, ro: 0, start: T_SKY, dur: 0.8, anim: "fadeIn" },
  {
    id: "bhill_d",
    ti: 4,
    ro: 2,
    start: T_BACKHILL,
    dur: SLIDE_DUR,
    anim: "slideUp",
  },
  // Front hill + castle arrive at the same time
  {
    id: "fhill_d",
    ti: 12,
    ro: 5,
    start: T_FC,
    dur: SLIDE_DUR,
    anim: "slideUp",
  },
  { id: "cast_d", ti: 14, ro: 7, start: T_FC, dur: SLIDE_DUR, anim: "slideUp" },

  // Lite cross-fade (rendered on top of matching dark layer)
  { id: "sky_l", ti: 1, ro: 1, start: T_LITE, dur: DUR_LITE, anim: "fadeIn" },
  { id: "bhill_l", ti: 5, ro: 3, start: T_LITE, dur: DUR_LITE, anim: "fadeIn" },
  {
    id: "fhill_l",
    ti: 13,
    ro: 6,
    start: T_LITE,
    dur: DUR_LITE,
    anim: "fadeIn",
  },
  { id: "cast_l", ti: 15, ro: 8, start: T_LITE, dur: DUR_LITE, anim: "fadeIn" },

  // White clouds — drop from above with elastic bounce, then drift
  {
    id: "cloud1",
    ti: 10,
    ro: 4,
    start: T_CLOUD1,
    dur: DUR_CLOUD,
    anim: "bounceCloud",
    driftPhase: 0,
  },
  {
    id: "cloud2",
    ti: 11,
    ro: 4,
    start: T_CLOUD2,
    dur: DUR_CLOUD,
    anim: "bounceCloud",
    driftPhase: Math.PI * 0.7,
  },

  // Title (lite version — we're in day mode by this point)
  {
    id: "title",
    ti: 19,
    ro: 9,
    start: T_TITLE,
    dur: DUR_TITLE,
    anim: "slideUp",
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
}) {
  const { viewport } = useThree();
  const refs = useRef({});
  const startT = useRef(null);
  const menuFired = useRef(false);
  const boltWasOn = useRef(false);
  const musicFired = useRef(false);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (startT.current === null) startT.current = now;
    const t = now - startT.current;
    const H = viewport.height;

    // ── Standard animated layers ──────────────────────────────────────────────
    for (const item of SEQUENCE) {
      const { id, start, dur, anim, driftPhase } = item;
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

        case "bounceCloud": {
          const restY = H * CLOUD_REST_Y_FACTOR;
          mesh.material.opacity = Math.min(1, raw * 6);
          if (raw < 1) {
            // Drop from above screen to resting position with elastic overshoot.
            mesh.position.y = restY + (1 - easeOutElastic(raw)) * H;
          } else {
            // Gentle sinusoidal drift once settled.
            const amp = H * 0.00175;
            const omega = (2 * Math.PI) / 0.5; // 500ms period
            mesh.position.y =
              restY + Math.sin(t * omega + (driftPhase || 0)) * amp;
          }
          break;
        }
      }
    }

    // ── Start music when lite fade begins ─────────────────────────────────────
    if (!musicFired.current && t >= T_LITE) {
      musicFired.current = true;
      playMusic();
      playBirds();
    }

    // ── Fade dark layers OUT as lite layers fade IN ───────────────────────────
    if (t >= T_LITE) {
      for (const id of DARK_LAYER_IDS) {
        const mesh = refs.current[id];
        if (!mesh) continue;
        const raw = Math.min(1, (t - T_LITE) / DUR_LITE);
        mesh.material.opacity = 1 - easeOut(raw); // 1→0
      }
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

    if (!menuFired.current && t >= MENU_SHOW_T) {
      menuFired.current = true;
      onMenuReady();
    }
  });

  const { width: w, height: h } = viewport;

  const mesh = (id, ti, ro) => (
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
      {SEQUENCE.map(({ id, ti, ro }) => mesh(id, ti, ro))}
      {/* Lightning bolt — visible briefly before each screen flash */}
      {mesh("bolt", 3, 19)}
      {/* Full-screen flash frames — always painted above everything else */}
      {mesh("flash_bg", 16, 20)}
      {mesh("flash_fg", 17, 21)}
    </>
  );
}

function PreloadedScene({ onMenuReady }) {
  const textures = useTexture(ALL_TEXTURE_PATHS);
  const { play: playLightningStrike } = useSfx(
    `${BASE}sfx/dragon-studio-lightning-strike-386161.mp3`,
  );
  const { play: playThunderStrike } = useSfx(
    `${BASE}sfx/tanweraman-thunder-strike-wav-321628.mp3`,
  );
  const { play: playMusic } = useMusic(
    `${BASE}music/juliush-awakening-chill-out-music-1295.mp3`,
    { loop: true },
  );
  const { play: playBirds } = useSfx(
    `${BASE}sfx/loswin23-morning-birds-499429.mp3`,
  );
  return (
    <SceneContent
      textures={textures}
      onMenuReady={onMenuReady}
      playLightningStrike={playLightningStrike}
      playThunderStrike={playThunderStrike}
      playMusic={playMusic}
      playBirds={playBirds}
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
    setTimeout(onNewGame, 480);
  }

  return (
    <div className={styles.root}>
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 100] }}
        className={styles.canvas}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <PreloadedScene onMenuReady={() => setMenuVisible(true)} />
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
        <MenuItem label="Settings" />
        <MenuItem label="Credits" />
      </div>
    </div>
  );
}
