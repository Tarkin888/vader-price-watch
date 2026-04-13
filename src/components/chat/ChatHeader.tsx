import { RotateCcw, Bug, X } from "lucide-react";
import { useChat } from "./ChatProvider";
import KennyAvatar from "./KennyAvatar";

export default function ChatHeader() {
  const { setIsOpen, resetSession, sendMessage } = useChat();

  const handleBugMode = () => {
    sendMessage("I'd like to report a bug.");
  };

  return (
    <div
      className="flex items-center justify-between px-3 h-12 shrink-0"
      style={{ background: "rgba(201,168,76,0.08)" }}
    >
      <div className="flex items-center gap-2">
        <KennyAvatar size={32} />
        <span
          className="text-sm font-bold"
          style={{ color: "#C9A84C", fontFamily: "Aptos, 'Courier New', monospace" }}
        >
          Kenny
        </span>
      </div>
      <div className="flex items-center gap-1">
        {[
          { icon: RotateCcw, label: "New chat", onClick: resetSession },
          { icon: Bug, label: "Report bug", onClick: handleBugMode },
          { icon: X, label: "Close", onClick: () => setIsOpen(false) },
        ].map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            aria-label={label}
            className="p-1.5 rounded transition-colors"
            style={{ color: "#e0d8c0" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#C9A84C")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#e0d8c0")}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
