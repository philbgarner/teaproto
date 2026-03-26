import { useState, useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Suspense } from "react";

const FONT_URL = `${import.meta.env.BASE_URL}fonts/Metamorphous.ttf`;

function TitleText({ onReady }) {
  const groupRef = useRef();
  const notified = useRef(false);

  const handleSync = useCallback(() => {
    if (!notified.current) {
      notified.current = true;
      onReady();
    }
  }, [onReady]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.4) * 0.12;
      groupRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.7) * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <Text
        font={FONT_URL}
        fontSize={1.5}
        maxWidth={9}
        lineHeight={1.25}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#d4a520"
        outlineColor="#3a2500"
        outlineWidth={0.03}
        onSync={handleSync}
      >
        {"Cutest\nDungeon"}
      </Text>
    </group>
  );
}

const menuItemStyle = {
  background: "transparent",
  border: "none",
  color: "#e8c87a",
  fontSize: "1.35rem",
  fontFamily: "'Maison Neue', Georgia, serif",
  letterSpacing: "0.12em",
  padding: "0.55em 2.5em",
  cursor: "pointer",
  display: "block",
  textShadow: "0 0 18px rgba(212, 148, 10, 0.35)",
  transition: "color 0.18s, text-shadow 0.18s",
};

function MenuItem({ label, onClick }) {
  return (
    <button
      style={menuItemStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#ffffff";
        e.currentTarget.style.textShadow =
          "0 0 24px rgba(212, 148, 10, 0.9), 0 0 8px rgba(255,220,100,0.5)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#e8c87a";
        e.currentTarget.style.textShadow =
          "0 0 18px rgba(212, 148, 10, 0.35)";
      }}
    >
      {label}
    </button>
  );
}

export function TitleScreen({ onNewGame }) {
  const [fontReady, setFontReady] = useState(false);
  const [menuFading, setMenuFading] = useState(false);

  // Load Maison Neue into the document so HTML elements can use it
  useEffect(() => {
    const face = new FontFace(
      "Maison Neue",
      `url('${import.meta.env.BASE_URL}fonts/MaisonNeue.ttf') format('truetype')`
    );
    face.load().then((loaded) => document.fonts.add(loaded)).catch(() => {});
  }, []);

  function handleNewGame() {
    if (menuFading) return;
    setMenuFading(true);
    setTimeout(onNewGame, 480);
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#000",
      }}
    >
      {/* 3D Scene */}
      <Canvas
        camera={{ position: [0, 0.4, 9], fov: 58 }}
        style={{ position: "absolute", inset: 0 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[6, 4, 6]} intensity={3} color="#ffaa44" />
        <pointLight position={[-6, -2, 4]} intensity={1.2} color="#7733cc" />
        <pointLight position={[0, -6, 2]} intensity={0.5} color="#441100" />
        <Suspense fallback={null}>
          <TitleText onReady={() => setFontReady(true)} />
        </Suspense>
      </Canvas>

      {/* HTML menu overlay — classic HTML, no Drei Html */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "12vh",
          opacity: fontReady && !menuFading ? 1 : 0,
          transition: fontReady ? "opacity 0.45s ease-out" : "none",
          pointerEvents: fontReady && !menuFading ? "auto" : "none",
        }}
      >
        <MenuItem label="New Game" onClick={handleNewGame} />
        <MenuItem label="Settings" />
        <MenuItem label="Credits" />
      </div>

      {/* Black veil — covers everything until font is ready, then fades out */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: fontReady ? 0 : 1,
          transition: fontReady ? "opacity 0.6s ease-in" : "none",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
