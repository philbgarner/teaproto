import { useState } from "react";

const tabStyle = (active) => ({
  flex: 1,
  padding: "4px 0",
  background: active ? "#222" : "transparent",
  border: "none",
  borderBottom: active ? "2px solid #aaa" : "2px solid transparent",
  color: active ? "#eee" : "#666",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "monospace",
});

const SliderRow = ({ label, value, min, max, step, onChange, format }) => (
  <div style={{ fontSize: 11, color: "#888" }}>
    <div style={{ marginBottom: 2 }}>
      {label}: {format ? format(value) : value}
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: "100%" }}
    />
  </div>
);

export default function SettingsTabs({
  tempDropPerStep,
  setTempDropPerStep,
  satiationDropPerStep,
  setSatiationDropPerStep,
  supersatiationBonus,
  setSupersatiationBonus,
  turnsPerWave,
  setTurnsPerWave,
  dungeonSeed,
  setDungeonSeed,
  dungeonWidth,
  setDungeonWidth,
  dungeonHeight,
  setDungeonHeight,
  minLeafSize,
  setMinLeafSize,
  maxLeafSize,
  setMaxLeafSize,
  minRoomSize,
  setMinRoomSize,
  maxRoomSize,
  setMaxRoomSize,
}) {
  const [activeTab, setActiveTab] = useState("difficulty");
  const [seedInput, setSeedInput] = useState(String(dungeonSeed));

  const commitSeed = () => {
    const n = parseInt(seedInput, 10);
    if (!isNaN(n)) setDungeonSeed(n);
    else setSeedInput(String(dungeonSeed));
  };

  const randomizeSeed = () => {
    const n = Math.floor(Math.random() * 1_000_000);
    setDungeonSeed(n);
    setSeedInput(String(n));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #333", flexShrink: 0 }}>
        <button style={tabStyle(activeTab === "difficulty")} onClick={() => setActiveTab("difficulty")}>
          difficulty
        </button>
        <button style={tabStyle(activeTab === "world")} onClick={() => setActiveTab("world")}>
          world
        </button>
      </div>

      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>

      {activeTab === "difficulty" && (
        <>
          <SliderRow
            label="Cooling"
            value={tempDropPerStep}
            min={0}
            max={3}
            step={0.05}
            onChange={setTempDropPerStep}
            format={(v) => `${v.toFixed(2)}°/step`}
          />
          <SliderRow
            label="Satiation loss"
            value={satiationDropPerStep}
            min={0}
            max={1}
            step={0.01}
            onChange={setSatiationDropPerStep}
            format={(v) => `${v.toFixed(1)}/step`}
          />
          <SliderRow
            label="Preference bonus"
            value={supersatiationBonus}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setSupersatiationBonus(Math.round(v))}
            format={(v) => `${v}%`}
          />
          <SliderRow
            label="Turns/wave"
            value={turnsPerWave}
            min={10}
            max={300}
            step={5}
            onChange={(v) => setTurnsPerWave(Math.round(v))}
          />
        </>
      )}

      {activeTab === "world" && (
        <>
          {/* Seed row */}
          <div style={{ fontSize: 11, color: "#888" }}>
            <div style={{ marginBottom: 4 }}>Seed</div>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                type="text"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                onBlur={commitSeed}
                onKeyDown={(e) => e.key === "Enter" && commitSeed()}
                style={{
                  flex: 1,
                  background: "#111",
                  border: "1px solid #444",
                  color: "#ccc",
                  fontSize: 11,
                  padding: "2px 4px",
                  fontFamily: "monospace",
                  minWidth: 0,
                }}
              />
              <button
                onClick={randomizeSeed}
                style={{
                  background: "#333",
                  border: "1px solid #555",
                  color: "#ccc",
                  fontSize: 11,
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  flexShrink: 0,
                }}
              >
                rng
              </button>
            </div>
          </div>
          <SliderRow
            label="Size"
            value={dungeonWidth}
            min={20}
            max={80}
            step={1}
            onChange={(v) => { const n = Math.round(v); setDungeonWidth(n); setDungeonHeight(n); }}
          />
          <SliderRow
            label="Min leaf"
            value={minLeafSize}
            min={4}
            max={20}
            step={1}
            onChange={(v) => setMinLeafSize(Math.round(v))}
          />
          <SliderRow
            label="Max leaf"
            value={maxLeafSize}
            min={6}
            max={30}
            step={1}
            onChange={(v) => setMaxLeafSize(Math.round(v))}
          />
          <SliderRow
            label="Min room"
            value={minRoomSize}
            min={2}
            max={10}
            step={1}
            onChange={(v) => setMinRoomSize(Math.round(v))}
          />
          <SliderRow
            label="Max room"
            value={maxRoomSize}
            min={3}
            max={15}
            step={1}
            onChange={(v) => setMaxRoomSize(Math.round(v))}
          />
        </>
      )}

      </div>
    </div>
  );
}
