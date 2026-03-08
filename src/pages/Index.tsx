const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(201,168,76,0.03) 2px, rgba(201,168,76,0.03) 4px)",
        }}
      />

      {/* Terminal content */}
      <div className="z-20 text-center space-y-6">
        <div className="text-muted-foreground text-xs tracking-[0.5em] uppercase">
          ━━━ Secure Connection Established ━━━
        </div>

        <h1
          className="text-4xl md:text-6xl font-bold text-primary tracking-wider"
          style={{ animation: "flicker 4s infinite" }}
        >
          IMPERIAL PRICE
          <br />
          TERMINAL v3.0
        </h1>

        <div className="text-muted-foreground text-sm tracking-[0.3em]">
          VADER PRICE TRACKER
        </div>

        <div className="mt-8 border border-border p-4 inline-block">
          <span className="text-primary text-xs tracking-widest">
            &gt; AWAITING COMMAND INPUT_
          </span>
        </div>

        <div className="text-muted-foreground text-xs mt-4 tracking-wider">
          GALACTIC EMPIRE • CLASSIFIED • LEVEL 5 CLEARANCE
        </div>
      </div>
    </div>
  );
};

export default Index;
