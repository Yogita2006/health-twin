"use client";

// Puts the 3D digital twin on the page. The drawing itself lives in
// twinScene.ts; this file only connects it to React: it creates the scene when
// the page opens, passes in new data whenever the twin state changes, and
// cleans up when the page closes.
import { useEffect, useRef, useState } from "react";
import { MODEL_URL, createTwinScene, type TwinScene } from "./twinScene";
import { Region, TwinState } from "@/lib/engine/types";

interface Props {
  state: TwinState | null;
  selected: Region;
  onSelect: (region: Region) => void;
}

export default function TwinBody({ state, selected, onSelect }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const scene = useRef<TwinScene | null>(null);
  const latest = useRef<Props>({ state, selected, onSelect });
  const [unavailable, setUnavailable] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Whenever the data or the selection changes, recolour the organs.
  useEffect(() => {
    latest.current = { state, selected, onSelect };
    scene.current?.update(state, selected);
  }, [state, selected, onSelect]);

  // Create the 3D scene once, and remove it when the page closes.
  useEffect(() => {
    if (!holder.current) return;
    const created = createTwinScene({
      container: holder.current,
      modelUrl: MODEL_URL,
      onSelect: (region) => latest.current.onSelect(region),
      onLoaded: () => setLoaded(true),
    });
    if (!created) {
      setUnavailable(true);
      return;
    }
    scene.current = created;
    created.update(latest.current.state, latest.current.selected);
    return () => {
      created.dispose();
      scene.current = null;
    };
  }, []);

  return (
    <div ref={holder} className="hud-twin-canvas" role="img" aria-label="Interactive 3D body showing the status of each region">
      {unavailable && <p className="hud-empty">This device cannot show the 3D view. The same data is in the panels around it.</p>}
      {!unavailable && !loaded && <span className="hud-label hud-loading-3d">Loading 3D model</span>}
    </div>
  );
}
