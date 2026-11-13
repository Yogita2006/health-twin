"use client";

// An ECG-style trace whose beat rate follows the patient's latest heart rate.
// It is an illustration generated from one number. It is NOT a recorded ECG
// and shows nothing about the heart's electrical activity.
import { useEffect, useRef } from "react";

const HEIGHT = 120;
const SPEED = 110; // pixels per second the trace travels

// Height of the trace at a point in one beat (phase runs from 0 to 1).
// Five bumps imitate the familiar P, Q, R, S, T shape.
function beatShape(phase: number): number {
  const bump = (centre: number, width: number, height: number) =>
    height * Math.exp(-((phase - centre) ** 2) / (2 * width * width));
  return bump(0.18, 0.03, 0.12) + bump(0.37, 0.012, -0.14) + bump(0.4, 0.012, 1) + bump(0.43, 0.012, -0.22) + bump(0.65, 0.05, 0.25);
}

export default function Waveform({ bpm }: { bpm: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let samples: number[] = [];
    let phase = 0;
    let carry = 0;
    let lastTime = performance.now();
    let frame = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = Math.max(200, Math.floor(canvas.clientWidth));
      canvas.width = width * ratio;
      canvas.height = HEIGHT * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      samples = new Array(width).fill(0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, HEIGHT);

      // Faint grid, like monitor paper.
      ctx.strokeStyle = "rgba(34, 211, 238, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 24) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, HEIGHT);
      }
      for (let y = 0; y <= HEIGHT; y += 24) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      // The trace.
      const baseline = HEIGHT * 0.68;
      const scale = HEIGHT * 0.52;
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let x = 0; x < samples.length; x++) {
        const y = baseline - samples[x] * scale;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Add as many new points on the right as the trace travelled this frame.
      const rate = bpmRef.current ?? 0;
      carry += dt * SPEED;
      const steps = Math.floor(carry);
      carry -= steps;
      for (let i = 0; i < steps; i++) {
        phase = (phase + rate / 60 / SPEED) % 1;
        samples.push(rate > 0 ? beatShape(phase) : 0);
        samples.shift();
      }

      draw();
      frame = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);

    // People who ask their device for less motion get a still frame.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      for (let x = 0; x < samples.length; x++) samples[x] = beatShape((x / 160) % 1);
      draw();
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm text-slate-300">Heart rhythm trace</p>
        <p className="text-sm text-slate-400">{bpm ? `${Math.round(bpm)} bpm` : "waiting for data"}</p>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: HEIGHT, display: "block" }}
        role="img"
        aria-label={bpm ? `Illustrative heart rhythm trace at ${Math.round(bpm)} beats per minute` : "Heart rhythm trace, waiting for data"}
      />
      <p className="mt-2 text-xs text-slate-500">Illustrative trace driven by the latest heart rate. Not an ECG recording.</p>
    </div>
  );
}
