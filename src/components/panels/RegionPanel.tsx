"use client";

// Everything about the body region selected on the twin, in one panel:
// a turning 3D close-up of it
// and the stored data behind it.
import { StatusTag } from "@/components/hud/Hud";
import OrganView from "@/components/twin3d/OrganView";
import { REGION_METRICS } from "@/lib/engine/config";
import { HistoryRecord, TYPE_LABEL, statusWord } from "@/lib/history";
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


interface Props {
  state: TwinState | null;
  selected: Region;
  onSelect: (region: Region) => void;
  history?: HistoryRecord[]; // the patient's medical history, if it has been loaded
}

export default function RegionPanel({ state, selected, onSelect, history }: Props) {
  // Medical history records the patient linked to this part of the body.
  const related = (history ?? []).filter((record) => record.region === selected);
  const status: Status = state ? state.regions[selected] : "no_data";
  const metrics = REGION_METRICS[selected];

  return (
    <div className="hud-fill">
      <div className="hud-chips">
        {REGIONS.map((region) => (
          <button key={region} onClick={() => onSelect(region)} className={region === selected ? "hud-chip hud-chip-on" : "hud-chip"}>
            {REGION_LABEL[region]}
          </button>
        ))}
      </div>

      <div className="hud-split" style={{ marginTop: 12 }}>
        <div>
          <h3 className="hud-region-name" style={{ marginTop: 0 }}>
            {REGION_LABEL[selected]}
          </h3>
          <StatusTag status={status} />
        </div>
      </div>

      <OrganView state={state} selected={selected} />

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
                {metric.basis === "personal" ? "Usual range" : "Reference range"}: {metric.low.toFixed(info.decimals)} to {metric.high.toFixed(info.decimals)} {info.unit}
              </span>
            </div>
          );
        })}

      {related.length > 0 && (
        <div className="hud-note">
          <span className="hud-label">Medical history for this area</span>
          {related.slice(0, 4).map((record) => (
            <div key={record.id} className="hud-row" style={{ textTransform: "none" }}>
              <span>{record.title}</span>
              <span className="hud-label">
                {TYPE_LABEL[record.type]} / {statusWord(record)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
