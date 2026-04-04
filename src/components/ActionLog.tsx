import { useSettings } from "../SettingsContext";

export interface LogEntry {
  text: string;
  speaker?: string;
}

interface ActionLogProps {
  messages: LogEntry[];
}

export function ActionLog({ messages }: ActionLogProps) {
  const { showActionLog } = useSettings();
  if (!showActionLog || messages.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        pointerEvents: "none",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 420,
      }}
    >
      {messages.map((entry, i) => {
        // i=0 is oldest, i=messages.length-1 is newest
        const t = messages.length === 1 ? 1 : i / (messages.length - 1);
        const opacity = 0.6 + t * 0.9;
        return (
          <div
            key={i}
            style={{
              opacity,
              fontFamily: '"Metamorphous", serif',
              fontSize: 13,
              letterSpacing: "0.04em",
              textShadow: "0 1px 4px rgba(0,0,0,0.9)",
              lineHeight: 1.3,
              userSelect: "none",
            }}
          >
            {entry.speaker ? (
              <>
                <span style={{ color: "#a8d8a8" }}>{entry.speaker}:</span>
                <span style={{ color: "#f1f1f1" }}> &ldquo;{entry.text}&rdquo;</span>
              </>
            ) : (
              <span style={{ color: "#f1f1f1" }}>{entry.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
