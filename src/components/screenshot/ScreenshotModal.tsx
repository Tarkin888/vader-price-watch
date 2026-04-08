import { useState, useEffect } from "react";
import { X } from "lucide-react";
import ScreenshotCapture from "./ScreenshotCapture";
import ScreenshotPreview from "./ScreenshotPreview";
import ExtractionReviewForm from "./ExtractionReviewForm";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import { toast } from "sonner";
import type { ExtractedData } from "@/lib/screenshot-prices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type Step = "pin" | "capture" | "preview" | "review" | "done";

const ScreenshotModal = ({ open, onOpenChange, onSaved }: Props) => {
  const hasPin = () => !!sessionStorage.getItem("admin_pin");
  const [step, setStep] = useState<Step>("pin");
  const [imageSrc, setImageSrc] = useState<string>("");
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinChecking, setPinChecking] = useState(false);

  // Re-check PIN state when modal opens
  useEffect(() => {
    if (open) setStep(hasPin() ? "capture" : "pin");
  }, [open]);

  const handlePinSubmit = async () => {
    if (pinChecking || pin.length < 4) return;
    setPinChecking(true);
    try {
      const { data } = await supabase.functions.invoke("admin-verify-pin", { body: { pin } });
      if (data?.valid) {
        sessionStorage.setItem("admin_auth", "true");
        sessionStorage.setItem("admin_pin", pin);
        setStep("capture");
        setError(null);
      } else {
        setError("Invalid PIN");
      }
    } catch {
      setError("Failed to verify PIN");
    } finally {
      setPinChecking(false);
    }
  };

  const reset = () => {
    setStep(hasPin() ? "capture" : "pin");
    setImageSrc("");
    setExtracted(null);
    setLoading(false);
    setSaving(false);
    setError(null);
    setPin("");
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const handleImageCaptured = (base64: string) => {
    setImageSrc(base64);
    setStep("preview");
    setError(null);
  };

  const handleUrlSubmitted = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("screenshot-extract", {
        body: { mode: "url", url },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (!data.success) throw new Error(data.error);
      if (!data.extracted) {
        setError(data.reason || "Could not identify auction data from this page.");
        return;
      }
      setExtracted(data.extracted as ExtractedData);
      setStep("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to extract data");
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    setLoading(true);
    setError(null);
    try {
      // Strip data URI prefix for the API
      const base64 = imageSrc.replace(/^data:image\/[a-z+]+;base64,/, "");
      const { data, error: fnErr } = await supabase.functions.invoke("screenshot-extract", {
        body: { mode: "image", image: base64 },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (!data.success) throw new Error(data.error);
      if (!data.extracted) {
        setError(data.reason || "Could not identify auction data in this image.");
        setLoading(false);
        return;
      }
      setExtracted(data.extracted as ExtractedData);
      setStep("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to extract data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (record: Record<string, unknown>) => {
    setSaving(true);
    try {
      // Check duplicate
      const { data: existing } = await supabase
        .from("lots")
        .select("id")
        .eq("lot_ref", record.lot_ref as string)
        .eq("source", record.source as any)
        .limit(1);
      if (existing && existing.length > 0) {
        if (!confirm("A record with this lot ref + source already exists. Save anyway?")) {
          setSaving(false);
          return;
        }
      }

      const res = await adminWrite({ table: "lots", operation: "insert", data: record as Record<string, unknown> });
      if (!res.success) throw new Error(res.error || "Insert failed");
      toast.success("Record saved successfully");
      setStep("done");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70" onClick={close} />

      {/* Modal */}
      <div
        role="dialog"
        aria-label="Import auction record from screenshot"
        className="relative z-10 bg-[#0D0D0A] border border-[#C9A84C33] rounded-xl w-full max-w-[680px] max-h-[85vh] overflow-y-auto mx-4 sm:mx-auto max-sm:fixed max-sm:inset-0 max-sm:rounded-none max-sm:max-w-none max-sm:max-h-none max-sm:mx-0"
        onKeyDown={(e) => { if (e.key === "Escape") close(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#C9A84C33]">
          <h2 className="text-[#C9A84C] text-base font-bold tracking-wider font-mono">
            QUICK IMPORT
          </h2>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        {step !== "pin" && (
          <div className="flex items-center gap-2 px-5 py-2 text-[10px] tracking-wider font-mono text-muted-foreground">
            <span className={step === "capture" || step === "preview" ? "text-primary" : ""}>CAPTURE</span>
            <span>→</span>
            <span className={step === "review" ? "text-primary" : ""}>REVIEW</span>
            <span>→</span>
            <span className={step === "done" ? "text-primary" : ""}>CONFIRM</span>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4">
          {error && (
            <div className="mb-4 p-3 border border-amber-400/30 rounded text-amber-400 text-xs tracking-wider font-mono flex flex-col gap-2">
              <span>{error}</span>
              <div className="flex gap-2">
                <button onClick={reset} className="underline text-[#C9A84C]">Try Again</button>
                <button onClick={() => { setError(null); setExtracted({} as ExtractedData); setStep("review"); }} className="underline">
                  Fill Manually
                </button>
              </div>
            </div>
          )}

          {step === "pin" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-xs tracking-wider font-mono text-muted-foreground">Enter Admin PIN to continue</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                placeholder="PIN"
                className="w-40 text-center text-2xl tracking-[0.5em] py-3 rounded border bg-background border-border text-primary font-mono"
              />
              <button
                onClick={handlePinSubmit}
                disabled={pinChecking || pin.length < 4}
                className="px-6 py-2 rounded text-xs font-bold tracking-widest bg-primary text-primary-foreground disabled:opacity-50"
                style={{ minHeight: 44 }}
              >
                {pinChecking ? "CHECKING…" : "AUTHENTICATE"}
              </button>
            </div>
          )}

          {step === "capture" && (
            <ScreenshotCapture
              onImageCaptured={handleImageCaptured}
              onUrlSubmitted={handleUrlSubmitted}
            />
          )}

          {step === "preview" && (
            <ScreenshotPreview
              imageSrc={imageSrc}
              onExtract={handleExtract}
              onBack={reset}
              loading={loading}
            />
          )}

          {step === "review" && extracted && (
            <ExtractionReviewForm
              extracted={extracted}
              onSave={handleSave}
              onBack={reset}
              saving={saving}
              imageSrc={imageSrc || undefined}
            />
          )}

          {step === "done" && (
            <div className="text-center space-y-4 py-8">
              <div className="text-green-400 text-sm tracking-wider font-mono">
                ✓ Record saved successfully
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={reset}
                  className="px-4 py-2 text-xs tracking-wider font-mono border border-[#C9A84C] text-[#C9A84C] rounded hover:bg-[#C9A84C15]"
                >
                  Import Another
                </button>
                <button
                  onClick={close}
                  className="px-4 py-2 text-xs tracking-wider font-mono bg-[#C9A84C] text-background rounded"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {loading && step === "capture" && (
            <div className="flex items-center justify-center gap-2 mt-4 text-[#C9A84C] text-xs tracking-wider font-mono">
              <span className="animate-spin">⟳</span> Fetching page...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotModal;
