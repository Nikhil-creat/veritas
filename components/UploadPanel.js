"use client";

import { useState, useRef, useEffect } from "react";
import ScoreDial from "./ScoreDial";
import EvidenceList from "./EvidenceList";
import ElaHeatmap from "./ElaHeatmap";
import { downloadEvidenceReport } from "@/lib/generateReport";
import { analyzeVideoFile } from "@/lib/videoForensics";

const SAMPLE_TEXT =
  "It is important to note that in today's fast-paced world, technology plays a crucial role in shaping how we communicate. Moreover, as we delve into the tapestry of modern innovation, it becomes clear that furthermore, on the other hand, the realm of possibility continues to unlock the potential of connection.";

const TABS = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "text", label: "Text" }
];

export default function UploadPanel() {
  const [mode, setMode] = useState("image");
  const [textValue, setTextValue] = useState("");
  const [fileName, setFileName] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/analyze-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVideoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl(null);
    setError(null);
    setResult(null);
    setLoading(true);
    setProgress({ done: 0, total: 5 });
    try {
      const data = await analyzeVideoFile(file, {
        sampleCount: 5,
        onProgress: (done, total) => setProgress({ done, total })
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function handleTextAnalyze() {
    if (!textValue.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setResult(null);
    setError(null);
    setProgress(null);
  }

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex gap-1 rounded-sm border border-inkline p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchMode(tab.id)}
            className={`focus-ring rounded-sm px-4 py-1.5 text-sm transition-colors ${
              mode === tab.id ? "bg-paper text-ink" : "text-slate hover:text-paper"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "image" && (
        <div className="w-full max-w-xl">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="focus-ring flex w-full flex-col items-center gap-2 rounded-sm border border-dashed border-inkline bg-inkline/30 px-6 py-10 text-center transition-colors hover:border-flag"
          >
            <span className="font-serif text-lg text-paper">{fileName ? fileName : "Drop a case file here"}</span>
            <span className="text-sm text-slate">JPEG or PNG, up to 15MB</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>
      )}

      {mode === "video" && (
        <div className="w-full max-w-xl">
          <button
            onClick={() => videoInputRef.current?.click()}
            className="focus-ring flex w-full flex-col items-center gap-2 rounded-sm border border-dashed border-inkline bg-inkline/30 px-6 py-10 text-center transition-colors hover:border-flag"
          >
            <span className="font-serif text-lg text-paper">{fileName ? fileName : "Drop a clip here"}</span>
            <span className="text-sm text-slate">MP4 or WebM — analyzed as 5 sampled frames, in your browser</span>
          </button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={handleVideoChange}
          />
        </div>
      )}

      {mode === "text" && (
        <div className="flex w-full max-w-xl flex-col gap-3">
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Paste the passage under review..."
            rows={8}
            className="focus-ring w-full resize-none rounded-sm border border-inkline bg-inkline/30 p-4 text-sm text-paper placeholder:text-slate/70"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setTextValue(SAMPLE_TEXT)}
              className="focus-ring text-xs text-slate underline decoration-slate/40 underline-offset-4 hover:text-paper"
            >
              Try a sample passage
            </button>
            <button
              onClick={handleTextAnalyze}
              disabled={!textValue.trim() || loading}
              className="focus-ring rounded-sm bg-flag px-5 py-2 text-sm font-medium text-ink transition-opacity disabled:opacity-40"
            >
              Analyze passage
            </button>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate">
          {progress ? `Analyzing frame ${progress.done} of ${progress.total}…` : "Running forensic checks…"}
        </p>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}

      {result && (
        <div className="flex w-full flex-col items-center gap-6">
          <ScoreDial score={result.score} confidence={result.confidence} />

          <p className="max-w-xl text-center text-sm leading-relaxed text-paper/90">{result.summary}</p>

          <button
            onClick={() =>
              downloadEvidenceReport(result, {
                label: mode === "text" ? "pasted text" : fileName || `uploaded ${mode}`
              })
            }
            className="focus-ring rounded-sm border border-inkline px-4 py-2 text-xs font-medium uppercase tracking-wide text-paper transition-colors hover:border-flag hover:text-flag"
          >
            Download evidence report (PDF)
          </button>

          {mode === "image" && previewUrl && result.raw?.ela?.grid && (
            <ElaHeatmap imageUrl={previewUrl} grid={result.raw.ela.grid} gridSize={result.raw.ela.gridSize} />
          )}

          {mode === "video" && result.frames && (
            <div className="w-full max-w-xl">
              <div className="mb-2 text-xs text-slate">Per-frame scores</div>
              <div className="flex gap-2">
                {result.frames.map((f) => (
                  <div
                    key={f.index}
                    className="flex flex-1 flex-col items-center gap-1 rounded-sm border border-inkline py-2"
                  >
                    <span className="font-mono text-sm text-paper">{f.score}</span>
                    <span className="text-[10px] text-slate">{f.time}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <EvidenceList signals={result.signals} />

          {result.fingerprint && (
            <p className="font-mono text-[11px] text-slate/70">Perceptual fingerprint: {result.fingerprint}</p>
          )}
        </div>
      )}
    </div>
  );
}
