import { useState, useEffect, useCallback, useRef } from "react";
import { Clipboard, Upload, Link } from "lucide-react";

interface Props {
  onImageCaptured: (base64: string) => void;
  onUrlSubmitted: (url: string) => void;
  enabled?: boolean;
}

const ScreenshotCapture = ({ onImageCaptured, onUrlSubmitted }: Props) => {
  const [urlValue, setUrlValue] = useState("");
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
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

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
            onChange={(e) => setUrlValue(e.target.value)}
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
      </div>
    </div>
  );
};

export default ScreenshotCapture;
