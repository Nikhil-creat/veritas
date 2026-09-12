"use client";

export default function ScoreDial({ score, confidence }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  let ringColor = "#2D9C8A"; // verified
  let label = "Likely authentic";
  if (clamped < 40) {
    ringColor = "#C4523A"; // alert
    label = "Likely AI-generated / manipulated";
  } else if (clamped < 70) {
    ringColor = "#E8A23D"; // flag
    label = "Signs of manipulation";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label={`Trust score ${clamped} out of 100`}>
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#1B2740" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="90"
          y="86"
          textAnchor="middle"
          fontSize="40"
          fontFamily="IBM Plex Mono, monospace"
          fill="#F7F5F0"
        >
          {clamped}
        </text>
        <text x="90" y="108" textAnchor="middle" fontSize="12" fontFamily="Inter, sans-serif" fill="#64748B">
          / 100 trust score
        </text>
      </svg>
      <p className="text-sm font-medium" style={{ color: ringColor }}>
        {label}
      </p>
      {confidence && (
        <span className="rounded-sm border border-inkline px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-slate">
          {confidence} confidence
        </span>
      )}
    </div>
  );
}
