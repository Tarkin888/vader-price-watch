import { useState, useEffect, useCallback, useRef } from "react";
import { Clipboard, Upload, Link, FileText, ChevronDown } from "lucide-react";
import { SAMPLE_TEXTS, SAMPLE_LABELS, type SampleKey } from "./samples";
import { logActivity } from "@/lib/activity-log";

type Method = "paste" | "upload" | "url" | "text";

interface Props {
  onImageCaptured: (base64: string) => void;
  onUrlSubmitted: (url: string) => void;
  onTextSubmitted?: (text: string) => void;
  enabled?: boolean;
}

interface SourceHint {
  label: string;
  color: string;
}

const detectSourceFromUrl = (url: string): SourceHint | null => {
  if (!url.trim()) return null;
  const lower = url.toLowerCase();
  if (lower.includes("ha.com")) return { label: "HERITAGE", color: "#3B82F6" };
  if (lower.includes("ebay.")) return { label: "EBAY", color: "#22C55E" };
  if (lower.includes("vectis.co.uk")) return { label: "VECTIS", color: "#A855F7" };
  if (lower.includes("hakes.com")) return { label: "HAKES", color: "#F97316" };
  if (lower.includes("candtauctions")) return { label: "C&T", color: "#F59E0B" };
  if (lower.includes("lcgauctions")) return { label: "LCG", color: "#14B8A6" };
  if (lower.includes("facebook.com")) return { label: "FACEBOOK", color: "#60A5FA" };
  if (lower.startsWith("http") || (lower.includes(".") && lower.length > 4)) {
    return { label: "OTHER", color: "#6B7280" };
  }
  return null;
};

const detectSourceFromText = (text: string): SourceHint | null => {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();
  if (/\bha\.com\b/.test(lower)) return { label: "HERITAGE", color: "#3B82F6" };
  if (/\bhakes\.com\b/.test(lower)) return { label: "HAKES", color: "#F97316" };
  if (/\blcgauctions\.com\b/.test(lower)) return { label: "LCG", color: "#14B8A6" };
  if (/\bvectis\.co\.uk\b/.test(lower)) return { label: "VECTIS", color: "#A855F7" };
  if (/\bcandtauctions\.co\.uk\b/.test(lower)) return { label: "C&T", color: "#F59E0B" };
  if (/\bebay\.(com|co\.uk)\b/.test(lower)) return { label: "EBAY", color: "#22C55E" };
  if (/\bfacebook\.com\b/.test(lower)) return { label: "FACEBOOK", color: "#60A5FA" };
  return null;
};

const ScreenshotCapture = ({ onImageCaptured, onUrlSubmitted, onTextSubmitted, enabled = true }: Props) => {
  const [method, setMethod] = useState<Method>("paste");
  const [urlValue, setUrlValue] = useState("");
  const [urlSource, setUrlSource] = useState<SourceHint | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textSource, setTextSource] = useState<SourceHint | null>(null);
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sampleMenuRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (method !== "paste") return;
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
    [method]
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste, enabled]);

  // Close the sample dropdown on outside click / Escape
  useEffect(() => {
    if (!sampleMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (sampleMenuRef.current && !sampleMenuRef.current.contains(e.target as Node)) {
        setSampleMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSampleMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [sampleMenuOpen]);

  const loadSample = (key: SampleKey) => {
    setSampleMenuOpen(false);
    if (textValue.trim().length > 0) {
      const ok = confirm("Discard pasted text?");
      if (!ok) return;
    }
    const text = SAMPLE_TEXTS[key];
    setTextValue(text);
    setTextSource(detectSourceFromText(text));
    logActivity("quickimport.text.sample_loaded", null, { sample: key });
    // Focus textarea at end on next tick
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(text.length, text.length);
        ta.scrollTop = ta.scrollHeight;
      }
    });
  };

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
    setUrlSource(detectSourceFromUrl(val));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTextValue(val);
    setTextSource(detectSourceFromText(val));
  };

  // Switching method with pasted text → confirm
  const switchMethod = (next: Method) => {
    if (next === method) return;
    if (method === "text" && textValue.trim().length > 0) {
      const ok = confirm("Discard pasted text?");
      if (!ok) return;
      setTextValue("");
      setTextSource(null);
    }
    setMethod(next);
  };

  const tabBtn = (m: Method, Icon: typeof Clipboard, label: string) => (
    <button
      key={m}
      onClick={() => switchMethod(m)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] tracking-wider font-mono border transition-colors min-h-[40px] ${
        method === m
          ? "bg-[#C9A84C15] border-[#C9A84C] text-[#C9A84C]"
          : "border-[#C9A84C33] text-muted-foreground hover:border-[#C9A84C66] hover:text-[#C9A84C]"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const charCount = textValue.length;
  const counterColor =
    charCount > 20000
      ? "#EF4444"
      : charCount >= 500
      ? "#22C55E"
      : charCount >= 50
      ? "#F59E0B"
      : "#6B7280";

  const zoneClass =
    "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all min-h-[140px]";
  const zoneIdle = "border-[#C9A84C44] hover:border-[#C9A84C] hover:bg-[#C9A84C08]";

  return (
    <div className="flex flex-col gap-3">
      {/* Method tabs */}
      <div className="flex gap-1 rounded overflow-hidden">
        {tabBtn("paste", Clipboard, "Paste Screenshot")}
        {tabBtn("upload", Upload, "Upload File")}
        {tabBtn("url", Link, "Web URL")}
        {tabBtn("text", FileText, "Paste Text")}
      </div>

      {method === "paste" && (
        <>
          <p
            className="text-[10px] leading-snug"
            style={{ color: "#8a826a", fontFamily: '"Courier New", monospace' }}
          >
            Paste an auction lot screenshot from your clipboard (Ctrl+V / Cmd+V). Heritage, Hake's, Vectis, LCG, C&amp;T, eBay, and Facebook Marketplace are supported.
          </p>
          <div
            className={`${zoneClass} ${zoneIdle}`}
            tabIndex={0}
            role="button"
            aria-label="Paste a screenshot from clipboard"
          >
            <Clipboard className="w-8 h-8 text-[#C9A84C]" />
            <span className="text-[#C9A84C] text-xs tracking-wider font-mono">
              Paste a screenshot
            </span>
            <span className="text-muted-foreground text-[10px]">Ctrl+V / Cmd+V</span>
          </div>
        </>
      )}

      {method === "upload" && (
        <>
          <p
            className="text-[10px] leading-snug"
            style={{ color: "#8a826a", fontFamily: '"Courier New", monospace' }}
          >
            Upload a PNG or JPG screenshot of an auction lot page. Max 10 MB.
          </p>
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
        </>
      )}

      {method === "url" && (
        <>
          <p
            className="text-[10px] leading-snug"
            style={{ color: "#8a826a", fontFamily: '"Courier New", monospace' }}
          >
            Paste an auction lot URL. The app will fetch the page's Open Graph image and metadata, then run the same extraction pipeline as a screenshot.
          </p>
          <div className={`${zoneClass} ${zoneIdle} items-start`} tabIndex={0}>
            <div className="flex items-center gap-2">
              <Link className="w-6 h-6 text-[#C9A84C]" />
              <span className="text-[#C9A84C] text-xs tracking-wider font-mono">
                Paste a web link
              </span>
            </div>
            <input
              type="url"
              placeholder="https://..."
              value={urlValue}
              onChange={handleUrlChange}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground font-mono overflow-x-auto"
              aria-label="Auction URL"
            />
            <button
              onClick={() => {
                if (urlValue.trim()) onUrlSubmitted(urlValue.trim());
              }}
              disabled={!urlValue.trim()}
              className="px-4 py-1.5 text-[10px] tracking-wider bg-[#C9A84C] text-background rounded font-mono disabled:opacity-40"
            >
              Fetch
            </button>
            {urlSource && (
              <span
                className="px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold self-start"
                style={{
                  backgroundColor: `${urlSource.color}22`,
                  color: urlSource.color,
                  border: `1px solid ${urlSource.color}55`,
                }}
              >
                {urlSource.label}
              </span>
            )}
          </div>
        </>
      )}

      {method === "text" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <p
              className="text-[10px] leading-snug flex-1"
              style={{ color: "#8a826a", fontFamily: '"Courier New", monospace' }}
            >
              Paste raw text — scraper console output, auction page copy-paste, email forward, or forum post. Minimum 50 characters.
            </p>
            <div className="relative shrink-0" ref={sampleMenuRef}>
              <button
                type="button"
                onClick={() => setSampleMenuOpen((v) => !v)}
                title="Drop a pre-canned auction text block into the textarea to try the extractor"
                aria-haspopup="menu"
                aria-expanded={sampleMenuOpen}
                className="inline-flex items-center gap-1 text-[12px] tracking-wider hover:underline"
                style={{ color: "#C9A84C", fontFamily: '"Courier New", monospace' }}
              >
                [ Load sample
                <ChevronDown className="w-3 h-3" />
                ]
              </button>
              {sampleMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 z-50 min-w-[260px] rounded border-2 shadow-lg"
                  style={{
                    backgroundColor: "#080806",
                    borderColor: "#C9A84C",
                    fontFamily: '"Courier New", monospace',
                  }}
                >
                  {(Object.keys(SAMPLE_LABELS) as SampleKey[]).map((k) => (
                    <button
                      key={k}
                      role="menuitem"
                      type="button"
                      onClick={() => loadSample(k)}
                      className="w-full text-left px-3 py-2 hover:bg-[#1a1810] border-b border-[#C9A84C22] last:border-b-0"
                    >
                      <div className="text-[12px]" style={{ color: "#C9A84C" }}>
                        {SAMPLE_LABELS[k].title}
                      </div>
                      <div className="text-[10px]" style={{ color: "#8a826a" }}>
                        {SAMPLE_LABELS[k].description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        <div className="flex flex-col gap-2 p-4 border-2 border-dashed border-[#C9A84C44] rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#C9A84C]" />
            <span className="text-[#C9A84C] text-xs tracking-wider font-mono">
              Paste raw text
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={textValue}
            onChange={handleTextChange}
            rows={12}
            placeholder="Paste raw text from a scraper run, auction page, email, or forum post. The classifier will extract the first identifiable lot."
            className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground resize-y min-h-[260px] max-h-[480px]"
            style={{ fontFamily: '"Courier New", monospace' }}
            aria-label="Auction text"
          />
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-mono tracking-wider"
              style={{ color: counterColor }}
            >
              {charCount.toLocaleString()} / 20,000
            </span>
            {textSource ? (
              <span
                className="px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-bold"
                style={{
                  backgroundColor: `${textSource.color}22`,
                  color: textSource.color,
                  border: `1px solid ${textSource.color}55`,
                }}
              >
                {textSource.label}
              </span>
            ) : (
              <span
                className="px-2 py-0.5 rounded text-[9px] font-mono tracking-wider"
                style={{
                  backgroundColor: "#6B728022",
                  color: "#a39580",
                  border: "1px solid #6B728055",
                }}
              >
                SOURCE: AUTO-DETECT ON EXTRACT
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (textValue.trim().length >= 50 && onTextSubmitted) {
                onTextSubmitted(textValue.trim());
              }
            }}
            disabled={textValue.trim().length < 50}
            className="self-end px-4 py-1.5 text-[10px] tracking-wider bg-[#C9A84C] text-background rounded font-mono disabled:opacity-40"
          >
            Extract
          </button>
        </div>
        </>
      )}
    </div>
  );
};

export default ScreenshotCapture;
