"use client";

// The "cross-section" view inside the Region detail panel: an illustrative
// slice through the head (for the brain) or the chest (for everything else).
// The pictures are drawn by code (see scanArt.ts). They are not scans and hold
// no patient data. The outline colours of the lungs and heart follow the twin.
import { useEffect, useRef, useState } from "react";
import { StatusTag } from "@/components/hud/Hud";
import { drawScan, SCAN_SLICES, type ScanView } from "./scanArt";
import { Region, Status, TwinState } from "@/lib/engine/types";

const STATUS_COLOR: Record<Status, string> = {
  within: "#3ddc97",
  watch: "#f5b942",
  outside: "#ff6b6b",
  no_data: "#6b8a93",
};

export default function ImagingPanel({ state, selected }: { state: TwinState | null; selected: Region }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [slice, setSlice] = useState(Math.floor(SCAN_SLICES / 2));
  const view: ScanView = selected === "brain" ? "head" : "chest";

  const lungs: Status = state ? state.regions.lungs : "no_data";
  const heart: Status = state ? state.regions.heart : "no_data";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(120, Math.floor(canvas.clientWidth));
      const height = Math.max(120, Math.floor(canvas.clientHeight));
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawScan(ctx, width, height, view, slice, {
        line: "#36e3d6",
        dim: "rgba(54, 227, 214, 0.35)",
        bone: "#d9f6f4",
        lungs: STATUS_COLOR[lungs],
        heart: STATUS_COLOR[heart],
        label: "#8ab4bc",
      });
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [view, slice, lungs, heart]);

  return (
    <div>
      <canvas ref={canvasRef} className="hud-scan hud-note" role="img" aria-label={`Illustrative ${view} cross-section, slice ${slice + 1} of ${SCAN_SLICES}. Not a scan.`} />
      <div className="hud-split">
        <input
          type="range"
          className="hud-range"
          min={0}
          max={SCAN_SLICES - 1}
          value={slice}
          onChange={(event) => setSlice(Number(event.target.value))}
          aria-label="Slice position"
        />
        <span className="hud-label" style={{ whiteSpace: "nowrap" }}>
          Slice {slice + 1} / {SCAN_SLICES}
        </span>
      </div>
      {view === "chest" && (
        <div className="hud-legend" style={{ marginTop: 2 }}>
          <StatusTag status={lungs} label={`Lungs outline: ${lungs === "no_data" ? "no data" : lungs}`} />
          <StatusTag status={heart} label={`Heart outline: ${heart === "no_data" ? "no data" : heart}`} />
        </div>
      )}
      <p className="hud-label hud-note">Illustration drawn by code / Not a scan / No patient images are stored</p>
    </div>
  );
}
