import { useState, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import {
  parseCsvFile, findDuplicates, downloadErrorReport, importRows,
  type ParseResult, type ParsedRow,
} from "@/lib/inventory-csv";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}

const CollectionImportModal = ({ open, onOpenChange, onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dupRowNumbers, setDupRowNumbers] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFilename(""); setResult(null); setDupRowNumbers(new Set());
    setParsing(false); setImporting(false); setDragOver(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = useCallback(async (file: File) => {
    setFilename(file.name);
    setParsing(true);
    try {
      const parsed = await parseCsvFile(file);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated"); return; }
      const dups = await findDuplicates(parsed.validRows, user.id);
      setResult(parsed);
      setDupRowNumbers(dups);
    } catch (e: any) {
      toast.error("Failed to parse CSV: " + e.message);
    } finally {
      setParsing(false);
    }
  }, []);

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

  const handleImport = async () => {
    if (!result) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); return; }
    const toInsert = result.validRows.filter((r) => !dupRowNumbers.has(r.rowNumber));
    if (toInsert.length === 0) {
      toast.info("Nothing to import");
      return;
    }
    setImporting(true);
    try {
      const res = await importRows(toInsert, user.id);
      const errCount = result.errorRows.length;
      if (res.failed > 0 && res.inserted === 0) {
        toast.error("Import failed: " + (res.firstError ?? "unknown error"));
      } else {
        toast.success(`Imported ${res.inserted} records, skipped ${dupRowNumbers.size} duplicates, ${errCount} errors.`);
        logActivity("collection_added", null, {
          source: "csv_import",
          filename,
          imported: res.inserted,
          skipped: dupRowNumbers.size,
          errors: errCount,
        });
        onImported();
        handleClose(false);
      }
    } catch (e: any) {
      toast.error("Import failed: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const validCount = result ? result.validRows.length : 0;
  const dupCount = dupRowNumbers.size;
  const errCount = result ? result.errorRows.length : 0;
  const importableCount = validCount - dupCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="csv-import-desc">
        <DialogHeader>
          <DialogTitle className="text-primary tracking-wider text-sm">IMPORT INVENTORY CSV</DialogTitle>
          <DialogDescription id="csv-import-desc" className="text-muted-foreground text-[11px] tracking-wider">
            Drop a CSV file to validate and import. Use the template for the correct column format.
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
          >
            <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <div className="text-xs tracking-wider text-foreground mb-1">
              {parsing ? "Parsing…" : "Click to choose a CSV or drag & drop here"}
            </div>
            <div className="text-[10px] text-muted-foreground tracking-wider">
              Comment rows starting with # are ignored.
            </div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onChange} />
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs tracking-wider">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-foreground">{filename}</span>
              <button onClick={reset} className="ml-auto text-muted-foreground hover:text-primary"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] tracking-wider">
              <div className="border border-border rounded p-2 bg-secondary/30">
                <div className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="w-3 h-3" /> Ready</div>
                <div className="text-primary text-base font-bold">{importableCount}</div>
              </div>
              <div className="border border-border rounded p-2 bg-secondary/30">
                <div className="flex items-center gap-1 text-muted-foreground">Duplicates</div>
                <div className="text-amber-500 text-base font-bold">{dupCount}</div>
              </div>
              <div className="border border-border rounded p-2 bg-secondary/30">
                <div className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="w-3 h-3" /> Errors</div>
                <div className="text-destructive text-base font-bold">{errCount}</div>
              </div>
            </div>

            {errCount > 0 && (
              <div className="border border-border rounded">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-[11px] tracking-wider text-muted-foreground">Errors</span>
                  <button
                    onClick={() => downloadErrorReport(result.errorRows)}
                    className="text-[10px] tracking-wider text-primary hover:underline"
                  >
                    Download Error Report
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr className="text-left text-muted-foreground tracking-wider">
                        <th className="px-2 py-1">Row</th>
                        <th className="px-2 py-1">Field</th>
                        <th className="px-2 py-1">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errorRows.flatMap((r) =>
                        r.errors.map((err, i) => (
                          <tr key={`${r.rowNumber}-${i}`} className="border-t border-border/50">
                            <td className="px-2 py-1 text-muted-foreground">{r.rowNumber}</td>
                            <td className="px-2 py-1 text-amber-500">{err.field}</td>
                            <td className="px-2 py-1 text-foreground">{err.message}</td>
                          </tr>
                        ))
                      )}
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
                disabled={importableCount === 0 || importing}
                onClick={handleImport}
              >
                {importing ? "Importing…" : `Import ${importableCount} Row${importableCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CollectionImportModal;
