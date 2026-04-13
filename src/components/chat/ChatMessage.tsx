import PriceResultCards from "./PriceResultCard";
import { useChat } from "./ChatProvider";
import KennyAvatar from "./KennyAvatar";

interface Props {
  msg: {
    role: string;
    content: string;
    message_type: string;
    metadata: any;
  };
}

export default function ChatMessage({ msg }: Props) {
  const { retryLast } = useChat();
  const isUser = msg.role === "user";
  const isError = msg.message_type === "ERROR";
  const isBugConfirm = msg.message_type === "BUG_REPORT";
  const isFeedbackConfirm = msg.message_type === "FEEDBACK";

  // Strip any leaked [PRICE_QUERY] blocks from display text
  const displayContent = msg.content
    .replace(/\[PRICE_QUERY\][\s\S]*?(\[\/PRICE_QUERY\]|$)/g, "")
    .replace(/\[BUG_REPORT\][\s\S]*?(\[\/BUG_REPORT\]|$)/g, "")
    .replace(/\[FEEDBACK\][\s\S]*?(\[\/FEEDBACK\]|$)/g, "")
    .trim();

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2 ${!isUser ? "items-start gap-2" : ""}`}>
      {!isUser && (
        <div className="shrink-0 mt-1">
          <KennyAvatar size={28} />
        </div>
      )}
      <div
        className="max-w-[85%] px-3 py-2 text-[13px] whitespace-pre-wrap"
        style={{
          color: "#e0d8c0",
          background: isError
            ? "#2A1A1A"
            : isUser
            ? "rgba(201,168,76,0.13)"
            : "#1A1A16",
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          maxWidth: isUser ? "80%" : "85%",
        }}
      >
        {displayContent}

        {isBugConfirm && msg.metadata?.bugReportId && (
          <div className="mt-2 px-2 py-1 rounded-full text-[11px] inline-block"
            style={{ background: "rgba(91,165,91,0.2)", color: "#5BA55B" }}>
            ✓ Bug report submitted
          </div>
        )}

        {isFeedbackConfirm && msg.metadata?.feedbackId && (
          <div className="mt-2 px-2 py-1 rounded-full text-[11px] inline-block"
            style={{ background: "rgba(91,165,91,0.2)", color: "#5BA55B" }}>
            ✓ Feedback recorded
          </div>
        )}

        {isError && (
          <button
            onClick={retryLast}
            className="mt-2 text-xs underline block"
            style={{ color: "#C9A84C" }}
          >
            Retry
          </button>
        )}

        {msg.message_type === "PRICE_RESULT" && msg.metadata && (
          <PriceResultCards metadata={msg.metadata} />
        )}
      </div>
    </div>
  );
}
