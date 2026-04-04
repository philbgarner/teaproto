import { useState } from "react";
import { KeybindingsPanel } from "./components/KeybindingsPanel";
import styles from "./components/styles/SettingsTabs.module.css";

const SliderRow = ({ label, value, min, max, step, onChange, format }) => (
  <div className={styles.sliderRow}>
    <div className={styles.sliderLabel}>
      {label}: {format ? format(value) : value}
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={styles.slider}
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
  turnsPerRound,
  setTurnsPerRound,
  traversalFactor,
  setTraversalFactor,
  adventurerDreadRate,
  setAdventurerDreadRate,
  adventurerLootPerChest,
  setAdventurerLootPerChest,
  winRounds,
  setWinRounds,
  danceSatiationBoost,
  setDanceSatiationBoost,
  teaSatiationAmount,
  setTeaSatiationAmount,
  startIngredientAmount,
  setStartIngredientAmount,
  onResetToDefaults,
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
  trapDensity,
  setTrapDensity,
  torchColor,
  setTorchColor,
  torchIntensity,
  setTorchIntensity,
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

  const tab = (id, label) => (
    <button
      className={`${styles.tab} ${activeTab === id ? styles.tabActive : ""}`}
      onClick={() => setActiveTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.root}>
      <div className={styles.tabBar}>
        {tab("difficulty", "difficulty")}
        {tab("world", "world")}
        {tab("lighting", "lighting")}
        {tab("keys", "keys")}
      </div>

      <div className={styles.content}>
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
              label="Turns/round"
              value={turnsPerRound}
              min={10}
              max={300}
              step={5}
              onChange={(v) => setTurnsPerRound(Math.round(v))}
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
            <SliderRow
              label="Trap density"
              value={trapDensity}
              min={0}
              max={2}
              step={0.1}
              onChange={setTrapDensity}
              format={(v) => `${v.toFixed(1)}×`}
            />
            <SliderRow
              label="Rounds to win"
              value={winRounds}
              min={1}
              max={50}
              step={1}
              onChange={(v) => setWinRounds(Math.round(v))}
            />
            <SliderRow
              label="Dance satiation boost"
              value={danceSatiationBoost}
              min={0}
              max={50}
              step={1}
              onChange={(v) => setDanceSatiationBoost(Math.round(v))}
              format={(v) => `+${v}`}
            />
            <SliderRow
              label="Tea satiation"
              value={teaSatiationAmount}
              min={10}
              max={200}
              step={5}
              onChange={(v) => setTeaSatiationAmount(Math.round(v))}
            />
            <SliderRow
              label="Starting ingredients"
              value={startIngredientAmount}
              min={0}
              max={20}
              step={1}
              onChange={(v) => setStartIngredientAmount(Math.round(v))}
            />
            {onResetToDefaults && (
              <button
                className={styles.seedBtn}
                style={{ alignSelf: "flex-start", marginTop: "8px" }}
                onClick={onResetToDefaults}
              >
                reset to defaults
              </button>
            )}
          </>
        )}

        {activeTab === "world" && (
          <>
            <div>
              <div className={styles.seedHeader}>Seed</div>
              <div className={styles.seedRow}>
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  onBlur={commitSeed}
                  onKeyDown={(e) => e.key === "Enter" && commitSeed()}
                  className={styles.seedInput}
                />
                <button onClick={randomizeSeed} className={styles.seedBtn}>
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
          <KeybindingsPanel
            keybindings={keybindings}
            setKeybindings={setKeybindings}
          />
        )}

        {activeTab === "lighting" && (
          <>
            <SliderRow
              label="Torch intensity"
              value={torchIntensity}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => {
                setTorchIntensity(v);
                try {
                  localStorage.setItem("torchIntensity", String(v));
                } catch {
                  /* */
                }
              }}
              format={(v) => v.toFixed(2)}
            />
            <div>
              <div className={styles.colorLabel}>Torch colour</div>
              <input
                type="color"
                value={torchColor}
                onChange={(e) => {
                  setTorchColor(e.target.value);
                  try {
                    localStorage.setItem("torchColor", e.target.value);
                  } catch {
                    /* */
                  }
                }}
                onFocus={() => onPickerFocus?.()}
                onBlur={() => onPickerBlur?.()}
                className={styles.colorPicker}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
