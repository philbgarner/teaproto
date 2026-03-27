import { useState } from "react";
import { KeybindingsPanel } from "./components/KeybindingsPanel";

const tabStyle = (active) => ({
  flex: 1,
  padding: "4px 0",
  background: active ? "#222" : "transparent",
  border: "none",
  borderBottom: active ? "2px solid #aaa" : "2px solid transparent",
  color: active ? "#eee" : "#666",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "'Metamorphous', serif",
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
  heatingPerStep,
  setHeatingPerStep,
  satiationDropPerStep,
  setSatiationDropPerStep,
  supersatiationBonus,
  setSupersatiationBonus,
  turnsPerWave,
  setTurnsPerWave,
  traversalFactor,
  setTraversalFactor,
  adventurerDreadRate,
  setAdventurerDreadRate,
  adventurerLootPerChest,
  setAdventurerLootPerChest,
  dungeonSeed,
  setDungeonSeed,
  dungeonWidth,
  setDungeonWidth,
  setDungeonHeight,
  minLeafSize,
  setMinLeafSize,
  maxLeafSize,
  setMaxLeafSize,
  minRoomSize,
  setMinRoomSize,
  maxRoomSize,
  setMaxRoomSize,
  maxDoors,
  setMaxDoors,
  tintColors,
  setTintColors,
  onPickerFocus,
  onPickerBlur,
  keybindings,
  setKeybindings,
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
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #333",
          flexShrink: 0,
        }}
      >
        <button
          style={tabStyle(activeTab === "difficulty")}
          onClick={() => setActiveTab("difficulty")}
        >
          difficulty
        </button>
        <button
          style={tabStyle(activeTab === "world")}
          onClick={() => setActiveTab("world")}
        >
          world
        </button>
        <button
          style={tabStyle(activeTab === "lighting")}
          onClick={() => setActiveTab("lighting")}
        >
          lighting
        </button>
        <button
          style={tabStyle(activeTab === "keys")}
          onClick={() => setActiveTab("keys")}
        >
          keys
        </button>
      </div>

      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "8px 0",
        }}
      >
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
              label="Heating"
              value={heatingPerStep}
              min={0}
              max={10}
              step={0.25}
              onChange={setHeatingPerStep}
              format={(v) => `${v.toFixed(2)}/step`}
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
            <SliderRow
              label="Passage speed"
              value={traversalFactor}
              min={0.25}
              max={4}
              step={0.25}
              onChange={setTraversalFactor}
              format={(v) => `${v}×`}
            />
            <SliderRow
              label="Adventurer dread rate"
              value={adventurerDreadRate}
              min={0}
              max={5}
              step={0.1}
              onChange={setAdventurerDreadRate}
              format={(v) => `${v.toFixed(1)}/step`}
            />
            <SliderRow
              label="Loot per chest"
              value={adventurerLootPerChest}
              min={1}
              max={50}
              step={1}
              onChange={(v) => setAdventurerLootPerChest(Math.round(v))}
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
                    fontFamily: "'Metamorphous', serif",
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
                    fontFamily: "'Metamorphous', serif",
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
              onChange={(v) => {
                const n = Math.round(v);
                setDungeonWidth(n);
                setDungeonHeight(n);
              }}
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
            <SliderRow
              label="Max doors"
              value={maxDoors}
              min={0}
              max={20}
              step={1}
              onChange={(v) => setMaxDoors(Math.round(v))}
            />
          </>
        )}

        {activeTab === "keys" && keybindings && (
          <KeybindingsPanel keybindings={keybindings} setKeybindings={setKeybindings} />
        )}

        {activeTab === "lighting" && tintColors && (
          <>
            {[
              { label: "Band 0 (near)", desc: "" },
              { label: "Band 1", desc: "" },
              { label: "Band 2", desc: "" },
              { label: "Band 3 (far)", desc: "" },
            ].map(({ label }, i) => (
              <div key={i} style={{ fontSize: 11, color: "#888" }}>
                <div style={{ marginBottom: 2 }}>
                  {label} <span style={{ color: "#555" }}></span>
                </div>
                <input
                  type="color"
                  value={tintColors[i]}
                  onChange={(e) => {
                    const next = [...tintColors];
                    next[i] = e.target.value;
                    setTintColors(next);
                    try { localStorage.setItem("tintColors", JSON.stringify(next)); } catch {}
                  }}
                  onFocus={() => onPickerFocus?.()}
                  onBlur={() => onPickerBlur?.()}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: 2,
                    border: "1px solid #444",
                    background: "#111",
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
