import KennyAvatar, { KennyAvatarProps } from "@/components/kenny/KennyAvatar";

const SIZES: NonNullable<KennyAvatarProps["size"]>[] = ["xs", "sm", "md", "lg"];
const STATES: NonNullable<KennyAvatarProps["state"]>[] = ["idle", "thinking", "speaking"];

export default function DevKennyAvatar() {
  return (
    <div className="min-h-screen p-8" style={{ background: "#080806", color: "#e0d8c0", fontFamily: "Aptos, 'Courier New', monospace" }}>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#C9A84C" }}>
        Kenny Avatar — Preview
      </h1>
      <p className="mb-8 text-sm opacity-80">
        Sizes (xs/sm/md/lg) × States (idle/thinking/speaking). Bottom row toggles glow.
      </p>

      {STATES.map((state) => (
        <section key={state} className="mb-10">
          <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: "#C9A84C" }}>
            State: {state}
          </h2>
          <div className="flex items-end gap-8 flex-wrap">
            {SIZES.map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <KennyAvatar size={size} state={state} />
                <span className="text-xs opacity-60">{size}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-widest mb-4" style={{ color: "#C9A84C" }}>
          Glow variant (state: idle)
        </h2>
        <div className="flex items-end gap-8 flex-wrap">
          {SIZES.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <KennyAvatar size={size} glow />
              <span className="text-xs opacity-60">{size} + glow</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
