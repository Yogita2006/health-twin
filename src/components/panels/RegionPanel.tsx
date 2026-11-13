"use client";

// Shows the stored data behind whichever body region is selected in the 3D twin.
import { StatusTag } from "@/components/hud/Hud";
import { REGION_METRICS } from "@/lib/engine/config";
import { METRIC_INFO, Region, Status, TwinState } from "@/lib/engine/types";

export const REGION_LABEL: Record<Region, string> = {
  heart: "Heart",
  lungs: "Lungs",
  body: "Whole body",
  brain: "Brain",
  skeleton: "Skeleton",
};

export const REGIONS = Object.keys(REGION_LABEL) as Region[];

const NO_DATA_NOTE: Partial<Record<Region, string>> = {
  brain: "No neurological data is collected in this prototype, so this region shows no status.",
  skeleton: "No skeletal data is collected in this prototype, so this region shows no status.",
};

export default function RegionPanel({ state, selected, onSelect }: { state: TwinState | null; selected: Region; onSelect: (region: Region) => void }) {
  const status: Status = state ? state.regions[selected] : "no_data";
  const metrics = REGION_METRICS[selected];

  return (
    <div>
      <div className="hud-chips">
        {REGIONS.map((region) => (
          <button key={region} onClick={() => onSelect(region)} className={region === selected ? "hud-chip hud-chip-on" : "hud-chip"}>
            {REGION_LABEL[region]}
          </button>
        ))}
      </div>

      <h3 className="hud-region-name">{REGION_LABEL[selected]}</h3>
      <StatusTag status={status} />

      {metrics.length === 0 && <p className="hud-text hud-note">{NO_DATA_NOTE[selected]}</p>}

      {metrics.length > 0 && !state && <p className="hud-text hud-note">No readings yet. Send one from the virtual wearable.</p>}

      {metrics.length > 0 &&
        state &&
        metrics.map((m) => {
          const info = METRIC_INFO[m];
          const metric = state.metrics[m];
          return (
            <div key={m} className="hud-metric">
              <div className="hud-metric-top">
                <span>{info.label}</span>
                <StatusTag status={metric.status} />
              </div>
              <p className="hud-metric-value">
                {metric.value.toFixed(info.decimals)} <span className="hud-unit">{info.unit}</span>
              </p>
              <span className="hud-label">
                {metric.basis === "personal" ? "Your usual range" : "Reference range"}: {metric.low.toFixed(info.decimals)} to {metric.high.toFixed(info.decimals)} {info.unit}
              </span>
            </div>
          );
        })}
    </div>
  );
}
