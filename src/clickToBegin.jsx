import { useState, useEffect } from "react";
import { GameRoot } from "./GameRoot.jsx";

const BASE = import.meta.env.BASE_URL;

const PRELOAD_IMAGES = [
  "textures/atlas.png",
  "textures/icons.png",
  "textures/large_button_down.png",
  "textures/large_button_up.png",
  "textures/monsters.png",
  "textures/title/flower_sprite.png",
  "textures/title/layer1_lightning_shadow.png",
  "textures/title/layer2_back_hill_dark.png",
  "textures/title/layer2_back_hill_lite.png",
  "textures/title/layer3_blackcloud1.png",
  "textures/title/layer3_blackcloud2.png",
  "textures/title/layer4_lightning.png",
  "textures/title/layer5_graycloud1.png",
  "textures/title/layer5_graycloud2.png",
  "textures/title/layer5_whitecloud1.png",
  "textures/title/layer5_whitecloud2.png",
  "textures/title/layer6_hill_dark.png",
  "textures/title/layer6_hill_lite.png",
  "textures/title/layer7_castle_dark.png",
  "textures/title/layer7_castle_lite.png",
  "textures/title/lightning_flash_bkground.png",
  "textures/title/lightning_flash_foreground.png",
  "textures/title/sky_dark.png",
  "textures/title/sky_lite.png",
  "textures/title/title_dark.png",
  "textures/title/title_lite.png",
];

function preloadAll() {
  const imagePromises = PRELOAD_IMAGES.map(
    (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve; // don't block on a missing asset
        img.src = BASE + src;
      }),
  );

  const fontPromise = new FontFace(
    "Metamorphous",
    `url(${BASE}fonts/Metamorphous.ttf)`,
  )
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => {});

  return Promise.all([...imagePromises, fontPromise]);
}

export function ClickToBegin({ onBegin }) {
  const [loaded, setLoaded] = useState(false);
  const [clickedEarly, setClickedEarly] = useState(false);

  useEffect(() => {
    preloadAll().then(() => {
      setLoaded(true);
    });
  }, []);

  // If assets finished loading while waiting, fire onBegin automatically
  useEffect(() => {
    if (loaded && clickedEarly) onBegin();
  }, [loaded, clickedEarly, onBegin]);

  function handleClick() {
    if (loaded) {
      onBegin();
    } else {
      setClickedEarly(true);
    }
  }

  const isWaiting = clickedEarly && !loaded;

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "#2459c5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isWaiting ? "wait" : "pointer",
        zIndex: 9999,
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.7)",
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          animation: isWaiting
            ? "ctb-wiggle 0.6s ease-in-out infinite"
            : "ctb-pulse 2s ease-in-out infinite",
          margin: 0,
        }}
      >
        {isWaiting ? "Loading…" : "Click to Begin"}
      </p>
      <style>{`
        @keyframes ctb-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes ctb-wiggle {
          0%, 100% { transform: translateX(0); opacity: 1; }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

export function Root() {
  const [begun, setBegun] = useState(false);
  if (!begun) return <ClickToBegin onBegin={() => setBegun(true)} />;
  return <GameRoot />;
}
