import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["?"], description: "Open this keyboard shortcuts cheatsheet" },
      { keys: ["Esc"], description: "Close any open modal or dialog" },
      { keys: ["Ctrl", "B"], description: "Toggle sidebar (where available)" },
    ],
  },
  {
    title: "Notepad (/notepad)",
    shortcuts: [
      { keys: ["n"], description: "Create a new note" },
      { keys: ["/"], description: "Focus the search box" },
    ],
  },
  {
    title: "Kenny Chat",
    shortcuts: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift", "Enter"], description: "Insert a new line" },
      { keys: ["Esc"], description: "Close the chat panel" },
    ],
  },
  {
    title: "Forms & Inline Editing",
    shortcuts: [
      { keys: ["Enter"], description: "Submit / save value (estimated value cell, sign-in, PIN)" },
      { keys: ["Esc"], description: "Cancel inline edit" },
      { keys: ["←", "→"], description: "Navigate carousels (Knowledge Hub, image galleries)" },
    ],
  },
];

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd
    className="inline-flex items-center justify-center px-2 py-0.5 mx-0.5 rounded text-[11px] font-bold"
    style={{
      fontFamily: "'Courier New', monospace",
      background: "#0D0D0B",
      border: "1px solid #C9A84C",
      color: "#C9A84C",
      minWidth: 24,
      lineHeight: 1.4,
    }}
  >
    {children}
  </kbd>
);

const KeyboardShortcutsModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isInput =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true;

      // Esc closes the cheatsheet
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      // "?" (shift + /) opens the cheatsheet
      if (e.key === "?" && !isInput && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[200]"
        style={{ background: "rgba(0,0,0,0.7)" }}
        aria-hidden="true"
      />
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[92vw] max-w-[760px] max-h-[85vh] overflow-y-auto rounded-lg"
        style={{
          background: "#080806",
          border: "2px solid #C9A84C",
          color: "#e0d8c0",
          fontFamily: "'Courier New', monospace",
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3" style={{ borderBottom: "1px solid rgba(201,168,76,0.3)" }}>
          <h2 className="text-sm tracking-wider font-bold" style={{ color: "#C9A84C" }}>
            KEYBOARD SHORTCUTS
          </h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close cheatsheet"
            className="p-1 rounded hover:bg-white/5"
            style={{ color: "#e0d8c0", minHeight: 32, minWidth: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-column groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[11px] tracking-wider font-bold mb-2" style={{ color: "#C9A84C" }}>
                {group.title.toUpperCase()}
              </h3>
              <ul className="space-y-2">
                {group.shortcuts.map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-[12px]">
                    <span className="flex items-center flex-shrink-0">
                      {s.keys.map((k, ki) => (
                        <span key={ki} className="inline-flex items-center">
                          {ki > 0 && <span style={{ color: "rgba(224,216,192,0.5)", margin: "0 2px" }}>+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                    <span style={{ color: "#e0d8c0", textAlign: "right" }}>{s.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-[10px] mt-6 pt-3 text-center" style={{ color: "rgba(224,216,192,0.5)", borderTop: "1px solid rgba(201,168,76,0.2)" }}>
          Press <Kbd>?</Kbd> any time to reopen this list. <Kbd>Esc</Kbd> to close.
        </p>
      </div>
    </>
  );
};

export default KeyboardShortcutsModal;
