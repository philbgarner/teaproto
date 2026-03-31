import { useState } from "react";
import ModalPanel from "./ModalPanel";
import SettingsTabs from "../SettingsTabs";
import styles from "./styles/DifficultyModal.module.css";

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

export function DifficultyModal({ visible, onClose, settingsProps }) {
  const [presets, setPresets] = useState(loadPresets);
  const [newPresetName, setNewPresetName] = useState("");
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);

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
      opacity={pickerActive ? 0.6 : 1}
    >
      <div className={styles.layout}>
        {/* Left: Presets + JSON */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarLabel}>Presets</div>
          <div className={styles.presetList}>
            {presets.map((preset, i) => (
              <div key={i} className={styles.presetRow}>
                <button
                  className={styles.presetBtn}
                  onClick={() => applySettings(preset.settings)}
                >
                  {preset.name}
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDeletePreset(i)}
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
              className={styles.input}
            />
            <button className={styles.btn} onClick={handleSavePreset}>
              Save current
            </button>
          </div>

          <div className={styles.divider}>
            <button className={styles.btn} onClick={handleExport}>
              Export JSON
            </button>
            {exportText && (
              <textarea
                readOnly
                value={exportText}
                className={styles.textarea}
              />
            )}
            <button className={styles.btn} onClick={() => setShowImport(!showImport)}>
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
                  className={styles.textarea}
                />
                {importError && (
                  <div className={styles.error}>{importError}</div>
                )}
                <button className={styles.btn} onClick={handleImport}>
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sliders */}
        <div className={styles.content}>
          <SettingsTabs
            {...settingsProps}
            onPickerFocus={() => setPickerActive(true)}
            onPickerBlur={() => setPickerActive(false)}
          />
        </div>
      </div>
    </ModalPanel>
  );
}
