import { useChat } from "./ChatProvider";

const SUGGESTIONS = [
  "What's the highest ESB-41 sale?",
  "Report a bug",
  "How many POTF-92 records do we have?",
];

export default function ChatWelcome() {
  const { sendMessage } = useChat();

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-4">
      <h3 className="text-base font-bold" style={{ color: "#C9A84C" }}>
        Welcome to the IPT Assistant
      </h3>
      <p className="text-xs" style={{ color: "#e0d8c0" }}>
        I can help you with:
      </p>
      <div className="flex flex-col gap-2 w-full max-w-[280px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            className="text-left text-xs px-3 py-2 rounded-lg border transition-colors cursor-pointer"
            style={{
              color: "#e0d8c0",
              borderColor: "rgba(201,168,76,0.2)",
              background: "rgba(201,168,76,0.06)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(201,168,76,0.5)";
              e.currentTarget.style.background = "rgba(201,168,76,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(201,168,76,0.2)";
              e.currentTarget.style.background = "rgba(201,168,76,0.06)";
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
