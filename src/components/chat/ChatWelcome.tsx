import { useChat } from "./ChatProvider";
import { logActivity } from "@/lib/activity-log";

const SUGGESTION_CHIPS = [
  "How many SW-12A records do I have in 2025?",
  "Show my Heritage lots",
  "What's my most expensive figure?",
  "Recent ROTJ comps",
];

export default function ChatWelcome() {
  const { sendMessage } = useChat();

  const handleChipClick = (chipText: string) => {
    logActivity("kenny.suggestion_chip_click", null, { chipText });
    sendMessage(chipText);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-4 py-6 overflow-y-auto">
      <h3 className="text-base font-bold" style={{ color: "#C9A84C" }}>
        Hi, I'm Kenny — your Imperial Price Terminal assistant
      </h3>
      <p
        className="text-[11px] tracking-wider"
        style={{ color: "#8a826a", fontFamily: "'Courier New', monospace" }}
      >
        Try one to get started:
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => handleChipClick(chip)}
            className="text-[12px] px-3 py-1.5 rounded-full border transition-colors cursor-pointer"
            style={{
              fontFamily: "'Courier New', monospace",
              color: "#C9A84C",
              borderColor: "#C9A84C",
              background: "#0f0e0a",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1a1810";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#0f0e0a";
            }}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
