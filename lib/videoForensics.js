"use client";

import { fuseSignals } from "./scoreEngine";

// Runs entirely in the browser: no ffmpeg, no server-side video
// processing. We seek an HTML5 <video> element to evenly spaced
// timestamps, grab each frame onto a <canvas>, and reuse the existing
// /api/analyze-image endpoint per frame — the same forensic pipeline
// already built for stills, applied across time.

function extractFrame(video, canvas, time) {
  return new Promise((resolve, reject) => {
    function onSeeked() {
      video.removeEventListener("seeked", onSeeked);
      try {
        const ctx = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture this frame."))),
          "image/jpeg",
          0.92
        );
      } catch (err) {
        reject(err);
      }
    }
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

export async function analyzeVideoFile(file, { sampleCount = 5, onProgress } = {}) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load this video file."));
    });

    const duration = video.duration;
    if (!duration || !isFinite(duration) || duration <= 0) {
      throw new Error("Could not read a valid duration from this video.");
    }

    const canvas = document.createElement("canvas");
    const frameResults = [];

    for (let i = 0; i < sampleCount; i++) {
      // Sample interior points — the very first/last frame is often a
      // black or transitional frame and isn't representative.
      const t = (duration * (i + 1)) / (sampleCount + 1);
      const blob = await extractFrame(video, canvas, t);

      const formData = new FormData();
      formData.append("file", blob, `frame-${i}.jpg`);
      const res = await fetch("/api/analyze-image", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) frameResults.push({ time: t, score: data.score });
      onProgress?.(i + 1, sampleCount);
    }

    if (frameResults.length === 0) {
      throw new Error("Could not analyze any frame of this video.");
    }

    const scores = frameResults.map((f) => f.score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const signals = [
      {
        id: "frame-average",
        weight: 1,
        verdict: avgScore >= 70 ? "clear" : avgScore >= 40 ? "caution" : "flagged",
        title: `Average trust score across ${frameResults.length} sampled frames`,
        detail: `Frames sampled at even intervals scored an average of ${avgScore}/100 individually (range ${Math.min(
          ...scores
        )}–${Math.max(...scores)}).`
      },
      {
        id: "temporal-consistency",
        weight: 0.7,
        verdict: stdDev > 15 ? "flagged" : stdDev > 8 ? "caution" : "clear",
        title:
          stdDev > 15 ? "Inconsistent forensic signal across frames" : "Consistent forensic signal across frames",
        detail:
          stdDev > 15
            ? `Frame-to-frame score variation is high (std dev ${stdDev.toFixed(
                1
              )}) — some frames look meaningfully more synthetic than others, which is common when only part of a video (e.g. a swapped face) was regenerated rather than the whole frame.`
            : `Frame-to-frame score variation is low (std dev ${stdDev.toFixed(
                1
              )}), consistent with a video that wasn't selectively reprocessed frame by frame.`
      }
    ];

    const fused = fuseSignals(signals);

    return {
      score: fused.score,
      confidence: frameResults.length >= sampleCount ? fused.confidence : "low",
      summary: fused.summary,
      signals,
      frames: frameResults.map((f, i) => ({
        index: i,
        time: Number(f.time.toFixed(1)),
        score: f.score
      }))
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
