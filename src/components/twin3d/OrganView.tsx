"use client";

// A small 3D close-up of the selected body region. The drawing lives in
// organScene.ts; this file connects it to React.
import { useEffect, useRef, useState } from "react";
import { createOrganScene, type OrganScene } from "./organScene";
import { MODEL_URL } from "./twinScene";
import { Region, Status, TwinState } from "@/lib/engine/types";

export default function OrganView({ state, selected }: { state: TwinState | null; selected: Region }) {
  const holder = useRef<HTMLDivElement>(null);
  const scene = useRef<OrganScene | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const status: Status = state ? state.regions[selected] : "no_data";
  const heartRate = state ? state.metrics.hr.value : 0;
  const breathRate = state ? state.metrics.rr.value : 0;
  const latest = useRef({ selected, status, heartRate, breathRate });

  // Whenever the selection or the data changes, update the close-up.
  useEffect(() => {
    latest.current = { selected, status, heartRate, breathRate };
    scene.current?.show(selected, status, heartRate, breathRate);
  }, [selected, status, heartRate, breathRate]);

  // Create the 3D view once, and remove it when the page closes.
  useEffect(() => {
    if (!holder.current) return;
    const created = createOrganScene({ container: holder.current, modelUrl: MODEL_URL });
    if (!created) {
      setUnavailable(true);
      return;
    }
    scene.current = created;
    const now = latest.current;
    created.show(now.selected, now.status, now.heartRate, now.breathRate);
    return () => {
      created.dispose();
      scene.current = null;
    };
  }, []);

  return (
    <div ref={holder} className="hud-organ" role="img" aria-label={`3D close-up of the selected region: ${selected}`}>
      {unavailable && <p className="hud-empty">This device cannot show the 3D view.</p>}
    </div>
  );
}
