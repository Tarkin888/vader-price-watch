import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

const UserMenu = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initial = (profile?.display_name || user.email || "U")[0].toUpperCase();
  const avatarUrl = profile?.avatar_url;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center rounded-full overflow-hidden"
        style={{
          width: 28,
          height: 28,
          minWidth: 28,
          minHeight: 28,
          background: avatarUrl ? "transparent" : "rgba(201,168,76,0.2)",
          border: "1px solid rgba(201,168,76,0.4)",
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[11px] font-bold" style={{ color: "#C9A84C" }}>{initial}</span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[34px] w-56 rounded-lg py-3 px-4 z-50"
          style={{
            background: "#0D0D0B",
            border: "1px solid rgba(201,168,76,0.3)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <p className="text-sm font-bold truncate" style={{ color: "#C9A84C" }}>
            {profile?.display_name || user.email}
          </p>
          <p className="text-[11px] truncate mt-0.5" style={{ color: "#e0d8c0", opacity: 0.6 }}>
            {user.email}
          </p>
          <span
            className="inline-block mt-1 text-[9px] font-bold tracking-widest px-2 py-0.5 rounded"
            style={{
              color: isAdmin ? "#C9A84C" : "#e0d8c0",
              background: isAdmin ? "rgba(201,168,76,0.15)" : "rgba(224,216,192,0.1)",
            }}
          >
            {isAdmin ? "ADMIN" : "USER"}
          </span>
          <div className="my-2 h-px" style={{ background: "rgba(201,168,76,0.2)" }} />
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left text-[11px] tracking-wider py-2 transition-colors"
            style={{ color: "#e0d8c0", opacity: 0.8, minHeight: 44 }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
