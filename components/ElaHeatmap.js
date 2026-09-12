"use client";

import { useEffect, useRef } from "react";

// Renders the already-computed 8x8 error-level grid as a translucent
// heatmap over the analyzed image, so the forensic finding is something
// a person can actually see, not just a coefficient in a sentence.
export default function ElaHeatmap({ imageUrl, grid, gridSize }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!grid || !gridSize || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;

    function draw() {
      const w = img.clientWidth;
      const h = img.clientHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);

      const max = Math.max(...grid, 0.01);
      const cellW = w / gridSize;
      const cellH = h / gridSize;

      for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
          const value = grid[gy * gridSize + gx] ?? 0;
          const intensity = Math.min(1, value / max);
          ctx.fillStyle = `rgba(196, 82, 58, ${intensity * 0.55})`;
          ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
        }
      }
    }

    if (img.complete) draw();
    img.addEventListener("load", draw);
    window.addEventListener("resize", draw);
    return () => {
      img.removeEventListener("load", draw);
      window.removeEventListener("resize", draw);
    };
  }, [grid, gridSize, imageUrl]);

  if (!imageUrl || !grid) return null;

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-2">
      <div className="relative inline-block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={imageUrl} alt="Analyzed upload" className="block w-full rounded-sm border border-inkline" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      <p className="text-xs text-slate">
        Error-level heatmap — warmer cells recompressed differently than the rest of the frame.
      </p>
    </div>
  );
}
