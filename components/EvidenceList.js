"use client";

const VERDICT_STYLES = {
  clear: { color: "#2D9C8A", label: "Clear" },
  caution: { color: "#E8A23D", label: "Caution" },
  flagged: { color: "#C4523A", label: "Flagged" }
};

export default function EvidenceList({ signals }) {
  return (
    <div className="w-full max-w-xl">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-px flex-1 bg-paperline/30" />
        <span className="text-xs tracking-wide text-slate">Evidence checked</span>
        <div className="h-px flex-1 bg-paperline/30" />
      </div>
      <ul className="flex flex-col gap-3">
        {signals.map((signal) => {
          const style = VERDICT_STYLES[signal.verdict] || VERDICT_STYLES.caution;
          return (
            <li key={signal.id} className="rounded-sm border border-inkline bg-ink/60 p-4">
              <div className="mb-1.5 flex items-start justify-between gap-3">
                <h3 className="font-serif text-base text-paper">{signal.title}</h3>
                <span
                  className="shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium"
                  style={{ color: style.color, border: `1px solid ${style.color}` }}
                >
                  {style.label}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate">{signal.detail}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
