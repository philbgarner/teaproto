import { useState } from "react";
import ModalPanel from "./ModalPanel";
import SettingsTabs from "../SettingsTabs";

const SETTINGS_KEYS = [
  "tempDropPerStep",
  "heatingPerStep",
  "satiationDropPerStep",
  "supersatiationBonus",
  "turnsPerWave",
  "traversalFactor",
  "adventurerDreadRate",
  "adventurerLootPerChest",
  "dungeonSeed",
  "dungeonWidth",
  "dungeonHeight",
  "minLeafSize",
  "maxLeafSize",
  "minRoomSize",
  "maxRoomSize",
  "maxDoors",
];

const SETTERS = {
  tempDropPerStep: "setTempDropPerStep",
  heatingPerStep: "setHeatingPerStep",
  satiationDropPerStep: "setSatiationDropPerStep",
  supersatiationBonus: "setSupersatiationBonus",
  turnsPerWave: "setTurnsPerWave",
  traversalFactor: "setTraversalFactor",
  adventurerDreadRate: "setAdventurerDreadRate",
  adventurerLootPerChest: "setAdventurerLootPerChest",
  dungeonSeed: "setDungeonSeed",
  dungeonWidth: "setDungeonWidth",
  dungeonHeight: "setDungeonHeight",
  minLeafSize: "setMinLeafSize",
  maxLeafSize: "setMaxLeafSize",
  minRoomSize: "setMinRoomSize",
  maxRoomSize: "setMaxRoomSize",
  maxDoors: "setMaxDoors",
};

const DEFAULT_PRESETS = [
  {
    name: "Easy",
    settings: {
      tempDropPerStep: 0.25,
      heatingPerStep: 3.0,
      satiationDropPerStep: 0.25,
      supersatiationBonus: 75,
      turnsPerWave: 150,
      traversalFactor: 2.0,
      adventurerDreadRate: 0.5,
      adventurerLootPerChest: 5,
    },
  },
  {
    name: "Normal",
    settings: {
      tempDropPerStep: 0.5,
      heatingPerStep: 2.0,
      satiationDropPerStep: 0.5,
      supersatiationBonus: 50,
      turnsPerWave: 120,
      traversalFactor: 2.0,
      adventurerDreadRate: 1.0,
      adventurerLootPerChest: 10,
    },
  },
  {
    name: "Hard",
    settings: {
      tempDropPerStep: 1.0,
      heatingPerStep: 1.5,
      satiationDropPerStep: 0.75,
      supersatiationBonus: 25,
      turnsPerWave: 90,
      traversalFactor: 2.0,
      adventurerDreadRate: 2.0,
      adventurerLootPerChest: 15,
    },
  },
];

function loadPresets() {
  try {
    const stored = localStorage.getItem("tea-presets");
    if (stored) return JSON.parse(stored);
  } catch {
    return DEFAULT_PRESETS;
  }
  return DEFAULT_PRESETS;
}

function savePresetsToStorage(presets) {
  localStorage.setItem("tea-presets", JSON.stringify(presets));
}

const btnStyle = {
  background: "#333",
  border: "1px solid #555",
  color: "#ccc",
  fontSize: 11,
  padding: "3px 6px",
  cursor: "pointer",
  fontFamily: "'Metamorphous', serif",
  width: "100%",
};

export function DifficultyModal({ visible, onClose, settingsProps }) {
  const [presets, setPresets] = useState(loadPresets);
  const [newPresetName, setNewPresetName] = useState("");
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [showImport, setShowImport] = useState(false);

  const getCurrentSettings = () => {
    const s = {};
    for (const key of SETTINGS_KEYS) {
      s[key] = settingsProps[key];
    }
    return s;
  };

  const applySettings = (settings) => {
    for (const [key, setter] of Object.entries(SETTERS)) {
      if (settings[key] !== undefined && settingsProps[setter]) {
        settingsProps[setter](settings[key]);
      }
    }
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim() || `Preset ${presets.length + 1}`;
    const updated = [...presets, { name, settings: getCurrentSettings() }];
    setPresets(updated);
    savePresetsToStorage(updated);
    setNewPresetName("");
  };

  const handleDeletePreset = (index) => {
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    savePresetsToStorage(updated);
  };

  const handleExport = () => {
    const json = JSON.stringify(getCurrentSettings(), null, 2);
    setExportText(json);
    navigator.clipboard?.writeText(json).catch(() => {});
  };

  const handleImport = () => {
    try {
      const settings = JSON.parse(importText);
      applySettings(settings);
      setImportError("");
      setImportText("");
      setShowImport(false);
    } catch {
      setImportError("Invalid JSON");
    }
  };

  return (
    <ModalPanel
      visible={visible}
      onClose={onClose}
      title="Settings"
      closeButton
      maxHeight="80vh"
      width="70vw"
      top="2rem"
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          height: "calc(80vh - 5rem)",
          minHeight: 0,
        }}
      >
        {/* Left: Presets + JSON */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            borderRight: "1px solid #333",
            paddingRight: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 11, color: "#888" }}>Presets</div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minHeight: 0,
            }}
          >
            {presets.map((preset, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 4, alignItems: "center" }}
              >
                <button
                  onClick={() => applySettings(preset.settings)}
                  style={{
                    flex: 1,
                    background: "#222",
                    border: "1px solid #444",
                    color: "#ccc",
                    fontSize: 11,
                    padding: "3px 6px",
                    cursor: "pointer",
                    fontFamily: "'Metamorphous', serif",
                    textAlign: "left",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => handleDeletePreset(i)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#555",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "0 2px",
                    fontFamily: "'Metamorphous', serif",
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              type="text"
              placeholder="Preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              style={{
                background: "#111",
                border: "1px solid #444",
                color: "#ccc",
                fontSize: 11,
                padding: "3px 6px",
                fontFamily: "'Metamorphous', serif",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <button onClick={handleSavePreset} style={btnStyle}>
              Save current
            </button>
          </div>

          <div
            style={{
              borderTop: "1px solid #333",
              paddingTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <button onClick={handleExport} style={btnStyle}>
              Export JSON
            </button>
            {exportText && (
              <textarea
                readOnly
                value={exportText}
                style={{
                  background: "#111",
                  border: "1px solid #444",
                  color: "#aaa",
                  fontSize: 10,
                  fontFamily: "'Metamorphous', serif",
                  height: 80,
                  resize: "vertical",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            )}
            <button onClick={() => setShowImport(!showImport)} style={btnStyle}>
              Import JSON
            </button>
            {showImport && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <textarea
                  placeholder="Paste JSON here..."
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportError("");
                  }}
                  style={{
                    background: "#111",
                    border: "1px solid #444",
                    color: "#aaa",
                    fontSize: 10,
                    fontFamily: "'Metamorphous', serif",
                    height: 80,
                    resize: "vertical",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
                {importError && (
                  <div style={{ color: "#f44", fontSize: 10 }}>
                    {importError}
                  </div>
                )}
                <button onClick={handleImport} style={btnStyle}>
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sliders */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <SettingsTabs {...settingsProps} />
        </div>
      </div>
    </ModalPanel>
  );
}
