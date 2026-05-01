interface Props {
  original: string;
  polished: string;
  onAccept: () => void;
  onReject: () => void;
  onEditPolished: () => void;
}

const ChangelogPolishPreview = ({ original, polished, onAccept, onReject, onEditPolished }: Props) => {
  const colStyle: React.CSSProperties = {
    background: "#0D0D0B",
    border: "1px solid rgba(201,168,76,0.3)",
    borderRadius: 4,
    padding: 12,
    minHeight: 120,
    fontSize: 12,
    color: "#e0d8c0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    maxHeight: 320,
    overflow: "auto",
  };
  const headStyle: React.CSSProperties = {
    color: "#C9A84C",
    fontSize: 10,
    letterSpacing: "0.1em",
    fontWeight: 700,
    marginBottom: 6,
  };
  const btn = (bg: string, fg: string): React.CSSProperties => ({
    background: bg,
    color: fg,
    border: "1px solid rgba(201,168,76,0.4)",
    padding: "8px 14px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    minHeight: 44,
    cursor: "pointer",
  });

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <div>
          <div style={headStyle}>ORIGINAL</div>
          <div style={colStyle}>{original}</div>
        </div>
        <div>
          <div style={headStyle}>POLISHED</div>
          <div style={colStyle}>{polished}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={onReject} style={btn("transparent", "#C9A84C")}>REJECT</button>
        <button onClick={onEditPolished} style={btn("transparent", "#C9A84C")}>EDIT POLISHED</button>
        <button onClick={onAccept} style={btn("#C9A84C", "#080806")}>ACCEPT</button>
      </div>
    </div>
  );
};

export default ChangelogPolishPreview;
