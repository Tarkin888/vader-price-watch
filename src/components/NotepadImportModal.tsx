import { useState, useRef, useCallback, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import {
  parseMarkdown, dupKey, buildErrorReport,
  type ParsedNote, type ParseResult,
} from "@/lib/notepad-import";

const MAX_NOTES = 100;
const WARN_THRESHOLD = 90;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
  currentCount: number;
  onImported: () => void;
}

const NotepadImportModal = ({ open, onOpenChange, userId, currentCount, onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dupIndexes, setDupIndexes] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFilename(""); setResult(null); setDupIndexes(new Set());
    setParsing(false); setImporting(false); setDragOver(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!userId) { toast.error("Not authenticated"); return; }
    if (!file.name.toLowerCase().endsWith(".md")) {
      toast.error("Please choose a .md file");
      return;
    }
    setFilename(file.name);
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseMarkdown(text);

      // Look up existing notes (title + created_at) for duplicate matching.
      const { data: existing, error } = await supabase
        .from("user_notes" as any)
        .select("title, created_at")
        .eq("user_id", userId);
      if (error) throw error;

      const existingKeys = new Set(
        ((existing as unknown as Array<{ title: string; created_at: string }>) || [])
          .map((n) => dupKey(n.title, n.created_at))
      );
      const dups = new Set<number>();
      for (const n of parsed.notes) {
        if (existingKeys.has(dupKey(n.title, n.created))) dups.add(n.index);
      }
      setResult(parsed);
      setDupIndexes(dups);
    } catch (e: any) {
      toast.error("Failed to parse file: " + (e.message ?? "unknown error"));
    } finally {
      setParsing(false);
    }
  }, [userId]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const importable: ParsedNote[] = useMemo(() => {
    if (!result) return [];
    return result.notes.filter((n) => !dupIndexes.has(n.index));
  }, [result, dupIndexes]);

  const newCount = importable.length;
  const dupCount = dupIndexes.size;
  const errCount = result?.errors.length ?? 0;
  const projectedTotal = currentCount + newCount;
  const overCap = projectedTotal > MAX_NOTES;
  const nearCap = !overCap && projectedTotal >= WARN_THRESHOLD;

  const handleDownloadErrors = () => {
    if (!result || result.errors.length === 0) return;
    const md = buildErrorReport(result.errors);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notepad-import-errors-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleImport = async () => {
    if (!userId || !result || newCount === 0 || overCap) return;
    setImporting(true);
    let inserted = 0;
    let failed = 0;
    let firstError: string | null = null;

    for (const n of importable) {
      const row = {
        user_id: userId,
        title: n.title || "Untitled note",
        body: n.body,
        tags: n.tags.length > 0 ? n.tags : null,
        pinned: n.pinned,
        linked_lot_ref: n.linked_lot || null,
        linked_lot_source: null,
        source_context: { source: n.source || "imported" },
        created_at: n.created,
        updated_at: n.updated,
      };
      const { data, error } = await supabase
        .from("user_notes" as any)
        .insert(row)
        .select("id")
        .single();
      if (error) {
        failed++;
        if (!firstError) firstError = error.message;
        // If the 100-cap trigger fires mid-loop, stop.
        if (error.message?.includes("limit: 100")) break;
        continue;
      }
      inserted++;
      const insertedId = (data as { id: string } | null)?.id ?? null;
      logActivity("notepad.import", insertedId, {
        title: n.title,
        source: n.source,
        filename,
      });
    }

    setImporting(false);
    if (inserted > 0) {
      toast.success(`Imported ${inserted} note${inserted === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}.`);
      onImported();
      handleClose(false);
    } else {
      toast.error("Import failed: " + (firstError ?? "no notes inserted"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="md-import-desc">
        <DialogHeader>
          <DialogTitle className="text-primary tracking-wider text-sm">IMPORT NOTES (.MD)</DialogTitle>
          <DialogDescription id="md-import-desc" className="text-muted-foreground text-[11px] tracking-wider">
            Drop a Markdown file exported from Notepad. Duplicates (matched by title + created date) are skipped.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            style={{ minHeight: "44px" }}
          >
            <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <div className="text-xs tracking-wider text-foreground mb-1">
              {parsing ? "Parsing…" : "Click to choose a .md file or drag & drop here"}
            </div>
            <div className="text-[10px] text-muted-foreground tracking-wider">
              Notes must use the standard Notepad export frontmatter.
            </div>
            <input ref={inputRef} type="file" accept=".md,text/markdown" className="hidden" onChange={onChange} />
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs tracking-wider">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground truncate">{filename}</span>
              <button
                onClick={reset}
                className="ml-auto text-muted-foreground hover:text-primary"
                aria-label="Choose a different file"
                style={{ minWidth: "44px", minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] tracking-wider">
              <div className="border border-border rounded p-2 bg-secondary/30">
                <div className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="w-3 h-3" /> New</div>
                <div className="text-primary text-base font-bold">{newCount}</div>
              </div>
              <div className="border border-border rounded p-2 bg-secondary/30">
                <div className="flex items-center gap-1 text-muted-foreground"><CopyIcon className="w-3 h-3" /> Duplicates</div>
                <div className="text-amber-500 text-base font-bold">{dupCount}</div>
              </div>
              <div className="border border-border rounded p-2 bg-secondary/30">
                <div className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="w-3 h-3" /> Errors</div>
                <div className="text-destructive text-base font-bold">{errCount}</div>
              </div>
            </div>

            {/* Capacity banners */}
            {overCap && (
              <div className="px-3 py-2 rounded border text-[11px] tracking-wider"
                style={{ background: "rgba(220, 38, 38, 0.1)", borderColor: "rgba(220, 38, 38, 0.4)", color: "rgb(248, 113, 113)" }}>
                Importing {newCount} would push you to {projectedTotal} / {MAX_NOTES} entries.
                Delete some notes or remove entries from the file before importing.
              </div>
            )}
            {nearCap && (
              <div className="px-3 py-2 rounded border text-[11px] tracking-wider"
                style={{ background: "rgba(234, 179, 8, 0.1)", borderColor: "rgba(234, 179, 8, 0.3)", color: "rgb(234, 179, 8)" }}>
                Heads up — after import you'll be at {projectedTotal} / {MAX_NOTES} entries.
              </div>
            )}

            {errCount > 0 && (
              <div className="border border-border rounded">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-[11px] tracking-wider text-muted-foreground">Parse Errors</span>
                  <button
                    onClick={handleDownloadErrors}
                    className="text-[10px] tracking-wider text-primary hover:underline"
                  >
                    Download Errors-Only (.md)
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr className="text-left text-muted-foreground tracking-wider">
                        <th className="px-2 py-1">Note #</th>
                        <th className="px-2 py-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e) => (
                        <tr key={e.index} className="border-t border-border/50">
                          <td className="px-2 py-1 text-muted-foreground">{e.index}</td>
                          <td className="px-2 py-1 text-foreground">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" className="text-xs tracking-wider" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs tracking-wider"
                disabled={newCount === 0 || overCap || importing}
                onClick={handleImport}
              >
                {importing ? "Importing…" : `Import ${newCount} Note${newCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NotepadImportModal;
