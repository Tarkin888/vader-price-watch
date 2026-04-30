import { useState, useEffect, useCallback } from "react";
import { X, Upload, Link2, ArrowUp, ArrowDown, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import { logActivity } from "@/lib/activity-log";

const BUCKET = "lot-images";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const URL_RE = /^https?:\/\/.+\.(jpe?g|png|webp|gif)(\?.*)?$/i;

interface Props {
  articleId: string;
  articleTitle: string;
  /** "single" replaces image_urls[0]; "multi" exposes ordered list controls. */
  mode: "single" | "multi";
  initialUrls: string[];
  open: boolean;
  onClose: () => void;
  onSaved?: (newUrls: string[]) => void;
}

const ImageManagerModal = ({ articleId, articleTitle, mode, initialUrls, open, onClose, onSaved }: Props) => {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [pasteUrl, setPasteUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setUrls(initialUrls);
      setPasteUrl("");
    }
  }, [open, initialUrls]);

  const addUrl = useCallback((u: string) => {
    const trimmed = u.trim();
    if (!URL_RE.test(trimmed)) {
      toast.error("URL must be http(s) and end with .jpg, .png or .webp");
      return;
    }
    setUrls((prev) => (mode === "single" ? [trimmed] : [...prev, trimmed]));
    setPasteUrl("");
  }, [mode]);

  const handleFile = useCallback(async (file: File) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Only JPG, PNG or WebP files are supported");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File must be 2 MB or smaller");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `kh-articles/${articleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      toast.error(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data.publicUrl;
    setUrls((prev) => (mode === "single" ? [publicUrl] : [...prev, publicUrl]));
    setUploading(false);
    toast.success("Image uploaded");
  }, [articleId, mode]);

  const move = (i: number, dir: -1 | 1) => {
    setUrls((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (i: number) => setUrls((prev) => prev.filter((_, k) => k !== i));

  const save = async () => {
    setSaving(true);
    const res = await adminWrite({
      table: "knowledge_articles",
      operation: "update",
      data: { image_urls: urls },
      match: { column: "id", value: articleId },
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error || "Save failed");
      return;
    }
    logActivity("knowledge_hub.image_replace", articleId, { url_count: urls.length });
    toast.success("Images updated");
    onSaved?.(urls);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background border border-primary/40 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_0_24px_hsl(43_50%_54%/0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-primary tracking-wider">Replace Image</h3>
            <p className="text-[10px] text-muted-foreground tracking-wider mt-0.5 truncate max-w-[380px]">{articleTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current images */}
          <div>
            <p className="text-[10px] text-primary tracking-wider mb-2">Current Images ({urls.length})</p>
            {urls.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No images yet.</p>
            ) : (
              <ul className="space-y-2">
                {urls.map((u, i) => (
                  <li key={`${u}-${i}`} className="flex items-center gap-2 p-2 border border-border rounded bg-secondary/30">
                    <img src={u} alt="" className="w-10 h-10 object-contain rounded shrink-0" style={{ border: "1px solid #C9A84C" }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />
                    <span className="text-[10px] text-foreground truncate flex-1 font-mono">{u}</span>
                    {mode === "multi" && (
                      <>
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30 min-h-[32px] min-w-[32px]" title="Move up">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => move(i, 1)} disabled={i === urls.length - 1} className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30 min-h-[32px] min-w-[32px]" title="Move down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button onClick={() => remove(i)} className="p-1.5 text-muted-foreground hover:text-red-400 min-h-[32px] min-w-[32px]" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {mode === "single" && urls.length > 0 && (
              <p className="text-[10px] text-muted-foreground italic mt-1">Single-image article — adding a new image will replace the current one.</p>
            )}
          </div>

          {/* Paste URL */}
          <div>
            <label className="text-[10px] text-primary tracking-wider flex items-center gap-1.5 mb-1.5">
              <Link2 className="w-3 h-3" /> Paste Image URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 text-xs bg-secondary/30 border border-border rounded px-2 py-2 text-foreground focus:outline-none focus:border-primary/50 font-mono min-h-[44px]"
              />
              <button
                onClick={() => addUrl(pasteUrl)}
                disabled={!pasteUrl.trim()}
                className="text-[10px] tracking-wider px-3 py-2 rounded border border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-40 min-h-[44px]"
              >
                Add
              </button>
            </div>
          </div>

          {/* Upload File */}
          <div>
            <label className="text-[10px] text-primary tracking-wider flex items-center gap-1.5 mb-1.5">
              <Upload className="w-3 h-3" /> Upload File (≤ 2 MB · JPG, PNG, WebP)
            </label>
            <label className={`flex items-center justify-center gap-2 border border-dashed border-primary/40 rounded p-3 cursor-pointer hover:bg-primary/5 transition-colors min-h-[44px] ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-primary" />}
              <span className="text-xs text-foreground">{uploading ? "Uploading…" : "Choose file"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="text-[10px] tracking-wider px-3 py-2 rounded border border-border text-muted-foreground hover:text-foreground min-h-[44px]">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || uploading}
            className="text-[10px] tracking-wider px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 min-h-[44px] flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageManagerModal;
