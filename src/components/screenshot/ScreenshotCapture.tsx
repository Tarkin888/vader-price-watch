import { useState, useEffect, useCallback, useRef } from "react";
import { Clipboard, Upload, Link } from "lucide-react";

interface Props {
  onImageCaptured: (base64: string) => void;
  onUrlSubmitted: (url: string) => void;
  enabled?: boolean;
}

interface SourceHint {
  label: string;
  color: string;
}

const detectSource = (url: string): SourceHint | null => {
  if (!url.trim()) return null;
  const lower = url.toLowerCase();
  if (lower.includes("ha.com")) return { label: "HERITAGE", color: "#3B82F6" };
  if (lower.includes("ebay.")) return { label: "EBAY", color: "#22C55E" };
  if (lower.includes("vectis.co.uk")) return { label: "VECTIS", color: "#A855F7" };
  if (lower.includes("hakes.com")) return { label: "HAKES", color: "#F97316" };
  if (lower.includes("candtauctions")) return { label: "C&T", color: "#F59E0B" };
  if (lower.includes("lcgauctions")) return { label: "LCG", color: "#14B8A6" };
  if (lower.includes("facebook.com")) return { label: "FACEBOOK", color: "#60A5FA" };
  // Any other URL-like string → OTHER
  if (lower.startsWith("http") || (lower.includes(".") && lower.length > 4)) {
    return { label: "OTHER", color: "#6B7280" };
  }
  return null;
};

const ScreenshotCapture = ({ onImageCaptured, onUrlSubmitted, enabled = true }: Props) => {
  const [urlValue, setUrlValue] = useState("");
  const [detectedSource, setDetectedSource] = useState<SourceHint | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) readFile(file);
          return;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste, enabled]);

  const readFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("Image is too large. Please use a smaller screenshot (max 10 MB).");
      return;
    }
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      alert("Unsupported image format. Please use PNG, JPG, or WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onImageCaptured(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlValue(val);
    setDetectedSource(detectSource(val));
  };

  const zoneClass =
    "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all min-h-[140px]";
  const zoneIdle = "border-[#C9A84C44] hover:border-[#C9A84C] hover:bg-[#C9A84C08]";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Paste zone */}
      <div
        className={`${zoneClass} ${zoneIdle}`}
        tabIndex={0}
        role="button"
        aria-label="Paste a screenshot from clipboard"
        onClick={() => {
          /* focus to enable paste */
        }}
      >
        <Clipboard className="w-8 h-8 text-[#C9A84C]" />
        <span className="text-[#C9A84C] text-xs tracking-wider font-mono">
          Paste a screenshot
        </span>
        <span className="text-muted-foreground text-[10px]">Ctrl+V / Cmd+V</span>
      </div>

      {/* Upload zone */}
      <div
        className={`${zoneClass} ${zoneIdle}`}
        role="button"
        aria-label="Upload an image file"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 text-[#C9A84C]" />
        <span className="text-[#C9A84C] text-xs tracking-wider font-mono">
          Upload an image
        </span>
        <span className="text-muted-foreground text-[10px]">PNG, JPG, or WebP</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* URL zone */}
      <div className={`${zoneClass} ${zoneIdle}`} tabIndex={0}>
        <Link className="w-8 h-8 text-[#C9A84C]" />
        <span className="text-[#C9A84C] text-xs tracking-wider font-mono">
          Paste a web link
        </span>
        <div className="flex gap-1 w-full mt-1">
          <input
            type="url"
            placeholder="https://..."
            value={urlValue}
            onChange={handleUrlChange}
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
            aria-label="Auction URL"
          />
          <button
            onClick={() => {
              if (urlValue.trim()) onUrlSubmitted(urlValue.trim());
            }}
            disabled={!urlValue.trim()}
            className="px-2 py-1 text-[10px] tracking-wider bg-[#C9A84C] text-background rounded font-mono disabled:opacity-40"
          >
            Fetch
          </button>
        </div>
        {detectedSource && (
          <span
            className="px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold self-start"
            style={{
              backgroundColor: `${detectedSource.color}22`,
              color: detectedSource.color,
              border: `1px solid ${detectedSource.color}55`,
            }}
          >
            {detectedSource.label}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScreenshotCapture;
