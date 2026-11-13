"use client";

// "Genomic sequence": a turning double helix beside a made-up sequence.
// The sequence is synthetic (see helixArt.ts). It is generated from a seed,
// not read from a person, and it is not a genetic test.
import { useEffect, useMemo, useRef } from "react";
import { BASES, composition, drawHelix, makeSequence } from "./helixArt";

export default function GenomePanel({ seed }: { seed: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sequence = useMemo(() => makeSequence(seed), [seed]);
  const share = useMemo(() => composition(sequence), [sequence]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 150;
    const height = canvas.clientHeight || 200;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // People who ask their device for less motion get a still picture.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drawHelix(ctx, width, height, 0, sequence);
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const tick = () => {
      drawHelix(ctx, width, height, (performance.now() - startedAt) / 1000, sequence);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [sequence]);

  return (
    <div>
      <div className="hud-genome">
        <canvas ref={canvasRef} className="hud-helix" role="img" aria-label="Animated double helix illustration" />
        <div className="hud-genome-side">
          <span className="hud-label">Letter share in this sequence</span>
          {BASES.map((base) => (
            <div key={base} className="hud-base">
              <b>{base}</b>
              <div className="hud-bar">
                <i style={{ width: `${share[base]}%` }} />
              </div>
              <span>{share[base].toFixed(1)}%</span>
            </div>
          ))}
          <p className="hud-seq">{sequence.slice(0, 48).join("")}</p>
        </div>
      </div>
      <p className="hud-label hud-note">
        Synthetic demo sequence of {sequence.length} letters / Not genetic data / Not a genetic test
      </p>
    </div>
  );
}
