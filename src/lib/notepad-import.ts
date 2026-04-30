/**
 * Notepad Markdown import — parses files produced by the existing exporter.
 * Exporter format per note:
 *   ---
 *   title: "..."
 *   tags: ["a", "b"]
 *   pinned: true|false
 *   linked_lot: "..."
 *   source: "..."
 *   created: <ISO>
 *   updated: <ISO>
 *   ---
 *   <body>
 *
 * Notes are separated by a line containing only `---` (between blocks).
 */

export interface ParsedNote {
  index: number; // 1-based, for error reporting
  title: string;
  tags: string[];
  pinned: boolean;
  linked_lot: string;
  source: string;
  created: string; // ISO
  updated: string; // ISO
  body: string;
  rawBlock: string; // original markdown block, for error report
}

export interface ParseError {
  index: number;
  message: string;
  rawBlock: string;
}

export interface ParseResult {
  notes: ParsedNote[];
  errors: ParseError[];
}

/* ── YAML scalar helpers ── */
function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return t;
}

function parseTags(v: string): string[] {
  const t = v.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return [];
  const inner = t.slice(1, -1).trim();
  if (!inner) return [];
  // Split on commas not inside quotes
  const parts: string[] = [];
  let cur = "";
  let inStr: '"' | "'" | null = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      if (ch === "\\" && inner[i + 1]) { cur += ch + inner[i + 1]; i++; continue; }
      if (ch === inStr) { inStr = null; cur += ch; continue; }
      cur += ch;
    } else {
      if (ch === '"' || ch === "'") { inStr = ch; cur += ch; continue; }
      if (ch === ",") { parts.push(cur); cur = ""; continue; }
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => unquote(p)).filter((s) => s.length > 0);
}

function parseFrontmatter(yaml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

/**
 * Split a full markdown export into per-note blocks.
 * Blocks are separated by a line containing only `---` that sits BETWEEN
 * frontmatter sections (i.e. not the opening/closing `---` of a frontmatter).
 *
 * Strategy: find every `---` line, then walk pairs:
 *   - block opens at `---` (frontmatter open)
 *   - then `---` (frontmatter close)
 *   - body runs until next `---` that is followed by another `---` (start of
 *     the next note's frontmatter), or to end of file.
 */
export function splitBlocks(md: string): string[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const fenceIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") fenceIdx.push(i);
  }
  if (fenceIdx.length < 2) return [];

  const blocks: string[] = [];
  let i = 0;
  while (i < fenceIdx.length - 1) {
    const open = fenceIdx[i];
    const close = fenceIdx[i + 1];
    // Find end of body: the fence that immediately precedes the NEXT open fence.
    // Look ahead for two consecutive fences (separator + next open).
    let bodyEnd = lines.length;
    let nextOpenFenceIdx = -1;
    for (let k = i + 2; k < fenceIdx.length - 1; k++) {
      // Is fenceIdx[k] a separator immediately followed by another fence? Allow blank lines between.
      const sep = fenceIdx[k];
      const nextFence = fenceIdx[k + 1];
      // Confirm only blank lines between sep and nextFence
      let onlyBlank = true;
      for (let l = sep + 1; l < nextFence; l++) {
        if (lines[l].trim() !== "") { onlyBlank = false; break; }
      }
      if (onlyBlank) {
        bodyEnd = sep;
        nextOpenFenceIdx = k + 1;
        break;
      }
    }
    const block = lines.slice(open, bodyEnd).join("\n");
    blocks.push(block);
    if (nextOpenFenceIdx === -1) break;
    // Advance i to the next open fence position in fenceIdx
    i = nextOpenFenceIdx;
  }
  return blocks;
}

export function parseMarkdown(md: string): ParseResult {
  const blocks = splitBlocks(md);
  const notes: ParsedNote[] = [];
  const errors: ParseError[] = [];

  blocks.forEach((block, idx) => {
    const index = idx + 1;
    const lines = block.split("\n");
    if (lines[0].trim() !== "---") {
      errors.push({ index, message: "Missing opening frontmatter fence (---).", rawBlock: block });
      return;
    }
    // find closing fence
    let close = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") { close = i; break; }
    }
    if (close === -1) {
      errors.push({ index, message: "Missing closing frontmatter fence (---).", rawBlock: block });
      return;
    }
    const yaml = lines.slice(1, close).join("\n");
    const body = lines.slice(close + 1).join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
    const fm = parseFrontmatter(yaml);

    const title = unquote(fm.title ?? "").trim();
    const created = unquote(fm.created ?? "").trim();
    const updated = unquote(fm.updated ?? created).trim();
    const pinned = (fm.pinned ?? "false").trim().toLowerCase() === "true";
    const linked_lot = unquote(fm.linked_lot ?? "").trim();
    const source = unquote(fm.source ?? "manual").trim();
    const tags = parseTags(fm.tags ?? "[]");

    if (!title) {
      errors.push({ index, message: "Missing or empty 'title' field.", rawBlock: block });
      return;
    }
    if (!created || isNaN(new Date(created).getTime())) {
      errors.push({ index, message: "Missing or invalid 'created' timestamp.", rawBlock: block });
      return;
    }

    notes.push({
      index,
      title: title.slice(0, 200),
      tags,
      pinned,
      linked_lot,
      source,
      created,
      updated: updated && !isNaN(new Date(updated).getTime()) ? updated : created,
      body: body.slice(0, 10000),
      rawBlock: block,
    });
  });

  return { notes, errors };
}

/**
 * Build a duplicate-key for matching against existing notes.
 * Two notes are duplicates if they share title AND created timestamp (to the second).
 */
export function dupKey(title: string, createdISO: string): string {
  // Normalise to ISO seconds to avoid millisecond drift between exports.
  const t = new Date(createdISO);
  const iso = isNaN(t.getTime()) ? createdISO : t.toISOString().slice(0, 19);
  return `${title.trim().toLowerCase()}|||${iso}`;
}

/** Build an .md error report containing only the failing blocks + reasons. */
export function buildErrorReport(errors: ParseError[]): string {
  const blocks = errors.map((e) => {
    return [
      `<!-- ERROR Note #${e.index}: ${e.message} -->`,
      e.rawBlock,
    ].join("\n");
  });
  return blocks.join("\n\n---\n\n") + "\n";
}
