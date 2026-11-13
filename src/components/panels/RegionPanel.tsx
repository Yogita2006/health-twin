"use client";

// Shows the stored data behind whichever body region is selected in the 3D twin.
import { REGION_METRICS } from "@/lib/engine/config";
import { METRIC_INFO, Region, Status, TwinState } from "@/lib/engine/types";

export const REGION_LABEL: Record<Region, string> = {
  heart: "Heart",
  lungs: "Lungs",
  body: "Whole body",
  brain: "Brain",
  skeleton: "Skeleton",
};

const REGIONS = Object.keys(REGION_LABEL) as Region[];

const STATUS_TEXT: Record<Status, { label: string; className: string; dot: string }> = {
  within: { label: "Within range", className: "text-emerald-300", dot: "bg-emerald-400" },
  watch: { label: "Watch", className: "text-amber-300", dot: "bg-amber-400" },
  outside: { label: "Outside range", className: "text-red-300", dot: "bg-red-400" },
  no_data: { label: "No data", className: "text-slate-400", dot: "bg-slate-500" },
};

const NO_DATA_NOTE: Partial<Record<Region, string>> = {
  brain: "No neurological data is collected in this prototype, so this region shows no status.",
  skeleton: "No skeletal data is collected in this prototype, so this region shows no status.",
};

export default function RegionPanel({ state, selected, onSelect }: { state: TwinState | null; selected: Region; onSelect: (region: Region) => void }) {
  const status: Status = state ? state.regions[selected] : "no_data";
  const text = STATUS_TEXT[status];
  const metrics = REGION_METRICS[selected];

  return (
    <div className="flex h-full flex-col rounded-xl border border-cyan-500/20 bg-slate-900/60 p-5">
      <div className="flex flex-wrap gap-2">
        {REGIONS.map((region) => {
          const s = STATUS_TEXT[state ? state.regions[region] : "no_data"];
          return (
            <button
              key={region}
              onClick={() => onSelect(region)}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                region === selected ? "border-cyan-400 bg-cyan-400/15 text-cyan-100" : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
              {REGION_LABEL[region]}
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-xl font-semibold text-slate-100">{REGION_LABEL[selected]}</h3>
      <p className={`text-sm font-medium ${text.className}`}>{text.label}</p>

      {metrics.length === 0 && <p className="mt-4 text-sm text-slate-400">{NO_DATA_NOTE[selected]}</p>}

      {metrics.length > 0 && !state && <p className="mt-4 text-sm text-slate-400">No readings yet. Send one from the virtual wearable.</p>}

      {metrics.length > 0 && state && (
        <ul className="mt-4 space-y-3">
          {metrics.map((m) => {
            const info = METRIC_INFO[m];
            const metric = state.metrics[m];
            const mt = STATUS_TEXT[metric.status];
            return (
              <li key={m} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-300">{info.label}</span>
                  <span className={`text-xs font-medium ${mt.className}`}>{mt.label}</span>
                </div>
                <p className="mt-1 text-2xl font-semibold text-slate-100">
                  {metric.value.toFixed(info.decimals)} <span className="text-sm font-normal text-slate-400">{info.unit}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {metric.basis === "personal" ? "Your usual range" : "Reference range"}: {metric.low.toFixed(info.decimals)} to {metric.high.toFixed(info.decimals)} {info.unit}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-auto pt-4 text-xs text-slate-500">
        Drag to rotate, scroll to zoom, click an organ to select it. Colours show how each region compares with the range, not a diagnosis.
      </p>
    </div>
  );
}
