import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { useChat } from "./ChatProvider";

export default function ChatInput() {
  const { sendMessage, isLoading } = useChat();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 px-3 py-2" style={{ borderTop: "1px solid rgba(201,168,76,0.13)", background: "#0D0D0A" }}>
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Kenny about prices, report a bug..."
          rows={1}
          className="flex-1 resize-none text-[13px] px-3 py-2 rounded-lg outline-none"
          style={{
            background: "#1A1A16",
            border: "1px solid rgba(201,168,76,0.2)",
            color: "#e0d8c0",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isLoading}
          className="p-2 rounded-lg transition-opacity"
          style={{
            background: "#C9A84C",
            opacity: !text.trim() || isLoading ? 0.4 : 1,
          }}
          aria-label="Send message"
        >
          <Send size={16} color="#080806" />
        </button>
      </div>
    </div>
  );
}
