import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X } from "lucide-react";
import { COLLECTION_FEATURE_ENABLED } from "@/lib/feature-flags";

const PAGES = [
  "Price Tracker",
  "Price Tracker / Filters",
  "Price Tracker / Tile View",
  ...(COLLECTION_FEATURE_ENABLED ? ["My Collection"] : []),
  "Dashboard",
  "Knowledge Hub",
  "Changelog",
  "Kenny Chatbot",
  "Admin Dashboard",
  "Sign On / Auth",
  "Other",
] as const;

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

const SEV_COLORS: Record<string, string> = {
  Low: "#9E9E9E",
  Medium: "#FFEB3B",
  High: "#FF9800",
  Critical: "#F44336",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultPage?: string;
}

const BugReportModal = ({ open, onOpenChange, defaultPage }: Props) => {
  const [description, setDescription] = useState("");
  const [page, setPage] = useState(defaultPage || PAGES[0]);
  const [severity, setSeverity] = useState<string>("Medium");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resetForm = useCallback(() => {
    setDescription("");
    setPage(defaultPage || PAGES[0]);
    setSeverity("Medium");
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setError("");
  }, [defaultPage]);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setScreenshotFile(null);
      setScreenshotPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Screenshot must be under 5 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters");
      return;
    }
    if (description.trim().length > 2000) {
      setError("Description must be under 2000 characters");
      return;
    }
    setError("");
    setSaving(true);

    try {
      let screenshot_url: string | null = null;

      // Upload screenshot if present
      if (screenshotFile) {
        const ext = screenshotFile.name.split(".").pop() || "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("bug-screenshots")
          .upload(path, screenshotFile, { contentType: screenshotFile.type });
        if (uploadErr) throw new Error("Screenshot upload failed: " + uploadErr.message);
        const { data: urlData } = supabase.storage.from("bug-screenshots").getPublicUrl(path);
        screenshot_url = urlData.publicUrl;
      }

      // Call edge function
      const { data, error: fnErr } = await supabase.functions.invoke("submit-bug-report", {
        body: {
          page_or_feature: page,
          description: description.trim(),
          severity,
          screenshot_url,
        },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (!data?.ok) throw new Error(data?.error || "Unknown error");

      const shortId = (data.id as string).slice(0, 8).toUpperCase();
      toast.success(`Thanks — bug report #${shortId} received`);
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit bug report");
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "text-[10px] tracking-widest uppercase mb-1 block";
  const inputStyle: React.CSSProperties = {
    background: "hsl(var(--secondary))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))",
    padding: "8px 12px",
    borderRadius: 4,
    width: "100%",
    fontSize: 13,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary tracking-wider text-sm">REPORT A BUG</DialogTitle>
          <DialogDescription className="sr-only">Submit a bug report</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Page / Feature */}
          <div>
            <label className={labelClass} style={{ color: "hsl(var(--muted-foreground))" }}>PAGE / FEATURE *</label>
            <select value={page} onChange={(e) => setPage(e.target.value)} style={inputStyle}>
              {PAGES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass} style={{ color: "hsl(var(--muted-foreground))" }}>DESCRIPTION * (10–2000 chars)</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); if (error) setError(""); }}
              rows={4}
              style={{ ...inputStyle, minHeight: 100 }}
              placeholder="Describe what happened, what you expected, and any steps to reproduce..."
            />
            <div className="flex justify-between mt-0.5">
              {error && <span className="text-[10px] text-destructive">{error}</span>}
              <span className="text-[10px] ml-auto" style={{ color: "hsl(var(--muted-foreground))" }}>
                {description.length}/2000
              </span>
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className={labelClass} style={{ color: "hsl(var(--muted-foreground))" }}>SEVERITY</label>
            <div className="flex gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className="flex-1 py-2 rounded text-[11px] font-bold tracking-wider transition-all"
                  style={{
                    background: severity === s ? `${SEV_COLORS[s]}30` : "hsl(var(--secondary))",
                    color: severity === s ? SEV_COLORS[s] : "hsl(var(--muted-foreground))",
                    border: `1px solid ${severity === s ? SEV_COLORS[s] : "hsl(var(--border))"}`,
                    minHeight: 44,
                  }}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot */}
          <div>
            <label className={labelClass} style={{ color: "hsl(var(--muted-foreground))" }}>SCREENSHOT (optional, max 5 MB)</label>
            {screenshotPreview ? (
              <div className="relative rounded overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                <img src={screenshotPreview} alt="Screenshot preview" className="w-full max-h-48 object-contain" style={{ background: "#111" }} />
                <button
                  onClick={() => { setScreenshotFile(null); setScreenshotPreview(null); }}
                  className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded"
                  style={{ background: "rgba(26,26,26,0.8)" }}
                >
                  <X className="w-3.5 h-3.5 text-primary" />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-1 py-4 rounded cursor-pointer transition-colors"
                style={{ border: "2px dashed hsl(var(--border))", background: "hsl(var(--secondary))", minHeight: 80 }}
              >
                <Upload className="w-5 h-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>Click or drag an image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" className="text-xs tracking-wider" onClick={() => { resetForm(); onOpenChange(false); }}>
            CANCEL
          </Button>
          <Button size="sm" className="text-xs tracking-wider" onClick={handleSubmit} disabled={saving}>
            {saving ? "SUBMITTING…" : "SUBMIT REPORT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BugReportModal;
