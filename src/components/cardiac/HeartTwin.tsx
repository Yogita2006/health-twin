"use client";

// A 3D heart from the digital twin, used by the what-if simulation.
// It reuses the close-up scene from the patient's twin (organScene.ts). The
// colour follows the status passed in and the heart beats at the given rate.
// It is a picture of the estimate, not an image of the patient's own heart.
import { useEffect, useRef, useState } from "react";
import { createOrganScene, type OrganScene } from "@/components/twin3d/organScene";
import { MODEL_URL } from "@/components/twin3d/twinScene";
import { Status } from "@/lib/engine/types";

export default function HeartTwin({ status, heartRate, label }: { status: Status; heartRate: number; label: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const scene = useRef<OrganScene | null>(null);
  const latest = useRef({ status, heartRate });
  const [unavailable, setUnavailable] = useState(false);

  // Whenever the estimate or the heart rate changes, update the heart.
  useEffect(() => {
    latest.current = { status, heartRate };
    scene.current?.show("heart", status, heartRate, 0);
  }, [status, heartRate]);

  // Create the 3D view once, and remove it when the panel closes.
  useEffect(() => {
    if (!holder.current) return;
    const created = createOrganScene({ container: holder.current, modelUrl: MODEL_URL });
    if (!created) {
      setUnavailable(true);
      return;
    }
    scene.current = created;
    created.show("heart", latest.current.status, latest.current.heartRate, 0);
    return () => {
      created.dispose();
      scene.current = null;
    };
  }, []);

  return (
    <div ref={holder} className="hud-organ cx-heart" role="img" aria-label={label}>
      {unavailable && <p className="hud-empty">This device cannot show the 3D view.</p>}
    </div>
  );
}
