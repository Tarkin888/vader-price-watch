import { useState } from "react";
import PriceResultCards from "./PriceResultCard";
import { useChat } from "./ChatProvider";
import KennyAvatar from "./KennyAvatar";
import SaveToNotepadPopover from "./SaveToNotepadPopover";
import { Bookmark, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  msg: {
    role: string;
    content: string;
    message_type: string;
    metadata: any;
  };
}

export default function ChatMessage({ msg }: Props) {
  const { retryLast, messages } = useChat();
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Find the user message immediately preceding this assistant message
  const precedingUserQuestion = (() => {
    if (isUser) return "";
    const idx = messages.findIndex((m) => m === (msg as any));
    // messages are ChatMessage objects with id; use reference-free lookup by content+type ordering
    // Fallback: walk from end backwards looking for last user before this content match
    let lastUser = "";
    for (const m of messages) {
      if (m.role === "user") lastUser = m.content;
      if (m.content === msg.content && m.message_type === msg.message_type) break;
    }
    return lastUser;
  })();

  const canSave = !isUser && !isError && displayContent.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2 ${!isUser ? "items-start gap-2" : ""}`}>
      {!isUser && (
        <div className="shrink-0 mt-1">
          <KennyAvatar size={28} />
        </div>
      )}
      <div className={isUser ? "" : "flex-1 min-w-0"} style={{ maxWidth: isUser ? "80%" : "85%" }}>
        <div
          className="px-3 py-2 text-[13px] whitespace-pre-wrap relative"
          style={{
            color: "#e0d8c0",
            background: isError
              ? "#2A1A1A"
              : isUser
              ? "rgba(201,168,76,0.13)"
              : "#1A1A16",
            borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
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

          {msg.message_type === "PRICE_RESULT" && msg.metadata &&
            ["list", "highest", "lowest", "average", "count"].includes(msg.metadata.aggregation) && (
            <PriceResultCards metadata={msg.metadata} />
          )}

          {/* Action row: copy + save to notepad — only on assistant bubbles */}
          {!isUser && displayContent.length > 0 && (
            <div className="flex justify-end gap-1 mt-1.5 -mb-0.5">
              <button
                onClick={handleCopy}
                aria-label="Copy message"
                title="Copy"
                className="p-1 rounded transition-colors opacity-50 hover:opacity-100"
                style={{ color: copied ? "#5BA55B" : "#C9A84C" }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
              <button
                onClick={() => canSave && setShowSavePopover((v) => !v)}
                aria-label="Save to Notepad"
                title={canSave ? "Save to Notepad" : "Cannot save this message"}
                disabled={!canSave}
                className="p-1 rounded transition-colors"
                style={{
                  color: "#C9A84C",
                  opacity: canSave ? 0.5 : 0.2,
                  cursor: canSave ? "pointer" : "not-allowed",
                }}
                onMouseEnter={(e) => {
                  if (canSave) e.currentTarget.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  if (canSave) e.currentTarget.style.opacity = "0.5";
                }}
              >
                <Bookmark size={11} />
              </button>
            </div>
          )}
        </div>

        {showSavePopover && canSave && (
          <SaveToNotepadPopover
            assistantContent={displayContent}
            precedingUserQuestion={precedingUserQuestion}
            metadata={msg.metadata}
            onClose={() => setShowSavePopover(false)}
          />
        )}
      </div>
    </div>
  );
}
