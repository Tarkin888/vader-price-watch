import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useChat } from "./ChatProvider";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";

export default function ChatWidget() {
  const { isOpen, setIsOpen, unreadCount } = useChat();
  const [pulseCount, setPulseCount] = useState(0);

  // Pulse animation on first load: 3 cycles
  useEffect(() => {
    if (pulseCount >= 3) return;
    const t = setTimeout(() => setPulseCount((c) => c + 1), 600);
    return () => clearTimeout(t);
  }, [pulseCount]);

  // Escape key closes panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, setIsOpen]);

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chat with IPT Assistant"
          className="fixed z-[9999] flex flex-col sm:bottom-[92px] sm:right-6 sm:w-[380px] sm:h-[520px] sm:max-h-[80vh] sm:rounded-xl
                     bottom-0 right-0 w-screen h-screen rounded-none"
          style={{
            background: "#0D0D0A",
            border: "1px solid rgba(201,168,76,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          <ChatHeader />
          <ChatMessages />
          <ChatInput />
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open chat assistant"
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all"
        style={{
          background: "#C9A84C",
          transform: pulseCount < 3 ? `scale(${1 + 0.05 * Math.sin(pulseCount * Math.PI)})` : "scale(1)",
          transition: "filter 0.2s, transform 0.3s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
      >
        <MessageCircle size={24} color="#080806" />
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-[#0D0D0A]" />
        )}
      </button>
    </>
  );
}
