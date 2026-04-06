import { useRef, useEffect } from "react";
import { useChat } from "./ChatProvider";
import ChatMessage from "./ChatMessage";
import ChatWelcome from "./ChatWelcome";

export default function ChatMessages() {
  const { messages, isLoading } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) return <ChatWelcome />;

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {messages.map((m) => (
        <ChatMessage key={m.id} msg={m} />
      ))}
      {isLoading && (
        <div className="flex gap-1.5 px-3 py-2 mb-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                background: "#C9A84C",
                animationDelay: `${i * 150}ms`,
                animationDuration: "600ms",
              }}
            />
          ))}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
