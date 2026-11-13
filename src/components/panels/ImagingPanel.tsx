"use client";

// "Imaging view": an illustrative cross-section of the head or chest.
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

const VIEW_LABEL: Record<ScanView, string> = { head: "Head", chest: "Chest" };
const VIEWS: ScanView[] = ["head", "chest"];

// The view that matches whichever region is selected on the 3D body.
const viewFor = (region: Region): ScanView => (region === "brain" ? "head" : "chest");

export default function ImagingPanel({ state, selected }: { state: TwinState | null; selected: Region }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [slice, setSlice] = useState(Math.floor(SCAN_SLICES / 2));
  // A view picked by hand stays until a different region is selected.
  const [choice, setChoice] = useState<{ region: Region; view: ScanView } | null>(null);
  const view = choice && choice.region === selected ? choice.view : viewFor(selected);

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
      <div className="hud-split">
        <div className="hud-chips">
          {VIEWS.map((v) => (
            <button key={v} onClick={() => setChoice({ region: selected, view: v })} className={v === view ? "hud-chip hud-chip-on" : "hud-chip"}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <span className="hud-label">
          Slice {slice + 1} / {SCAN_SLICES}
        </span>
      </div>

      <canvas ref={canvasRef} className="hud-scan hud-note" role="img" aria-label={`Illustrative ${VIEW_LABEL[view].toLowerCase()} cross-section, slice ${slice + 1} of ${SCAN_SLICES}. Not a scan.`} />

      <input
        type="range"
        className="hud-range"
        min={0}
        max={SCAN_SLICES - 1}
        value={slice}
        onChange={(event) => setSlice(Number(event.target.value))}
        aria-label="Slice position"
      />

      {view === "chest" && (
        <div className="hud-legend" style={{ marginTop: 4 }}>
          <StatusTag status={lungs} label={`Lungs outline: ${lungs === "no_data" ? "no data" : lungs}`} />
          <StatusTag status={heart} label={`Heart outline: ${heart === "no_data" ? "no data" : heart}`} />
        </div>
      )}
      <p className="hud-label hud-note">Illustration drawn by code / Not a scan / No patient images are stored</p>
    </div>
  );
}
