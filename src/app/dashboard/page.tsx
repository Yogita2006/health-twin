"use client";

// The main screen: the 3D twin in the centre, live data on the left,
// details, alerts and an overview on the right.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAlerts, useTwinState } from "@/hooks/useTwin";
import { useRecentReadings } from "@/hooks/useReadings";
import { HudLoading, HudPanel, HudShell, SHORT_LABEL, StatusTag } from "@/components/hud/Hud";
import Waveform from "@/components/panels/Waveform";
import TrendChart from "@/components/panels/TrendChart";
import RegionPanel, { REGION_LABEL } from "@/components/panels/RegionPanel";
import ImagingPanel from "@/components/panels/ImagingPanel";
import GenomePanel from "@/components/panels/GenomePanel";
import TwinBody from "@/components/twin3d/TwinBody";
import { BASELINE_MIN_READINGS } from "@/lib/engine/config";
import { METRICS, METRIC_INFO, Metric, MetricState, Region, Status, TwinState } from "@/lib/engine/types";

// Where each label sits around the 3D body.
const CALLOUTS: { region: Region; side: "left" | "right"; top: string }[] = [
  { region: "brain", side: "right", top: "7%" },
  { region: "lungs", side: "left", top: "22%" },
  { region: "heart", side: "right", top: "30%" },
  { region: "body", side: "left", top: "47%" },
  { region: "skeleton", side: "right", top: "60%" },
];

const SEVERITY: Record<Status, number> = { no_data: 0, within: 1, watch: 2, outside: 3 };
const worse = (a: Status, b: Status): Status => (SEVERITY[a] >= SEVERITY[b] ? a : b);

const show = (state: TwinState, m: Metric) => state.metrics[m].value.toFixed(METRIC_INFO[m].decimals);

// One line of stored data for each label next to the body.
function calloutData(state: TwinState, region: Region): string {
  if (region === "heart") return `${show(state, "hr")} bpm · ${show(state, "sys")}/${show(state, "dia")} mmHg`;
  if (region === "lungs") return `${show(state, "spo2")} % · ${show(state, "rr")} /min`;
  if (region === "body") return `${show(state, "tempC")} °C`;
  return "No data collected";
}

// Places a value on a bar where the middle half of the bar is the usual range.
function gaugePosition(metric: MetricState): number {
  const span = metric.high - metric.low;
  if (span <= 0) return 50;
  const position = 25 + ((metric.value - metric.low) / span) * 50;
  return Math.min(98, Math.max(2, position));
}

const outline = (status: Status) => (status === "watch" ? " hud-outline-watch" : status === "outside" ? " hud-outline-outside" : "");

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { state, ready } = useTwinState(user ? user.uid : null);
  const alerts = useAlerts(user ? user.uid : null);
  const readings = useRecentReadings(user ? user.uid : null);
  const [region, setRegion] = useState<Region>("heart");

  // Nobody reaches this page without signing in.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <HudLoading />;

  const withinCount = state ? METRICS.filter((m) => state.metrics[m].status === "within").length : 0;
  const pressure: Status = state ? worse(state.metrics.sys.status, state.metrics.dia.status) : "no_data";
  const restingSoFar = state ? Math.min(state.restingCount, BASELINE_MIN_READINGS) : 0;

  return (
    <HudShell active="overview" state={state}>
      {!ready && <p className="hud-empty">Loading your twin...</p>}

      {ready && !state && (
        <HudPanel index="00" title="No data yet" sub="Your twin is waiting for its first reading">
          <p className="hud-text">Open the virtual wearable and send a reading. This page will update by itself.</p>
          <p className="hud-note">
            <Link href="/wearable" className="hud-btn">
              Open virtual wearable
            </Link>
          </p>
        </HudPanel>
      )}

      {state && (
        <div className="hud-grid">
          {/* Left column: live data */}
          <div className="hud-col">
            <HudPanel index="01" title="Live physiology" sub="Latest reading / Compared with your range" right={<StatusTag status="within" label="Live" />}>
              <div className="hud-vitals">
                <div className={`hud-vital hud-vital-main${outline(state.metrics.hr.status)}`}>
                  <span className="hud-label">Heart rate</span>
                  <p className="hud-vital-value">
                    {show(state, "hr")} <span className="hud-unit">bpm</span>
                  </p>
                  <StatusTag status={state.metrics.hr.status} />
                </div>
                {(["spo2", "rr", "tempC"] as Metric[]).map((m) => (
                  <div key={m} className={`hud-vital${outline(state.metrics[m].status)}`}>
                    <span className="hud-label">{SHORT_LABEL[m]}</span>
                    <p className="hud-vital-value">
                      {show(state, m)} <span className="hud-unit">{METRIC_INFO[m].unit}</span>
                    </p>
                    <StatusTag status={state.metrics[m].status} />
                  </div>
                ))}
                <div className={`hud-vital${outline(pressure)}`}>
                  <span className="hud-label">Pressure</span>
                  <p className="hud-vital-value">
                    {show(state, "sys")}/{show(state, "dia")} <span className="hud-unit">mmHg</span>
                  </p>
                  <StatusTag status={pressure} />
                </div>
              </div>
              <div className="hud-note">
                <Waveform bpm={state.metrics.hr.value} />
              </div>
            </HudPanel>

            <HudPanel index="02" title="Imaging view" sub="Illustrative cross-section / Follows the selected region">
              <ImagingPanel state={state} selected={region} />
            </HudPanel>

            <HudPanel index="03" title="Baseline comparison" sub="Marker = latest value / Band = range" grow>
              {METRICS.map((m) => {
                const info = METRIC_INFO[m];
                const metric = state.metrics[m];
                return (
                  <div key={m} className="hud-gauge-row">
                    <div className="hud-gauge-top">
                      <span>{info.label}</span>
                      <b>
                        {metric.value.toFixed(info.decimals)} {info.unit}
                      </b>
                    </div>
                    <div className="hud-gauge" aria-hidden="true">
                      <div className="hud-gauge-band" />
                      <div className={`hud-gauge-mark hud-${metric.status}`} style={{ left: `${gaugePosition(metric)}%` }} />
                    </div>
                    <div className="hud-gauge-top">
                      <span className="hud-label">
                        {metric.basis === "personal" ? "Usual" : "Reference"}: {metric.low.toFixed(info.decimals)} to {metric.high.toFixed(info.decimals)}
                      </span>
                      <StatusTag status={metric.status} />
                    </div>
                  </div>
                );
              })}
            </HudPanel>
          </div>

          {/* Centre column: the 3D twin */}
          <div className="hud-col hud-col-centre">
            <HudPanel index="04" title="Human digital twin" sub="Interactive 3D model / Colours follow stored readings" right={<StatusTag status="within" label="Live model" />}>
              <div className="hud-twin">
                <TwinBody state={state} selected={region} onSelect={setRegion} />
                <div className="hud-callouts">
                  {CALLOUTS.map((c, i) => (
                    <button
                      key={c.region}
                      onClick={() => setRegion(c.region)}
                      className={`hud-callout hud-callout-${c.side}${c.region === region ? " hud-callout-on" : ""}`}
                      style={{ top: c.top }}
                    >
                      <span className="hud-label">
                        0{i + 1} / {REGION_LABEL[c.region]}
                      </span>
                      <span className="hud-callout-name">{REGION_LABEL[c.region]}</span>
                      <span className="hud-callout-data">{calloutData(state, c.region)}</span>
                      <StatusTag status={state.regions[c.region]} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="hud-legend">
                <StatusTag status="within" />
                <StatusTag status="watch" />
                <StatusTag status="outside" />
                <StatusTag status="no_data" />
              </div>
              <div className="hud-twin-foot">
                <span className="hud-label">01 / Drag to rotate</span>
                <span className="hud-label">02 / Scroll to zoom</span>
                <span className="hud-label">03 / Click an organ</span>
              </div>
            </HudPanel>

            <HudPanel index="05" title="Recent trend" sub={`Last ${readings.length} readings / Live`} grow>
              <TrendChart readings={readings} state={state} />
            </HudPanel>
          </div>

          {/* Right column: details, alerts, overview */}
          <div className="hud-col">
            <HudPanel index="06" title="Region detail" sub="Stored data behind the selected region">
              <RegionPanel state={state} selected={region} onSelect={setRegion} />
            </HudPanel>

            <HudPanel index="07" title="Genomic sequence" sub="Synthetic demo / Not genetic data">
              <GenomePanel seed={user.uid} />
            </HudPanel>

            <HudPanel index="08" title="Alerts" sub="Information only / Not a diagnosis" right={<span className="hud-label">{alerts.length} recent</span>}>
              {alerts.length === 0 ? (
                <p className="hud-text hud-plain">No alerts.</p>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="hud-alert">
                    <span className="hud-label">{new Date(alert.ts).toLocaleString()}</span>
                    <br />
                    {alert.message}
                  </div>
                ))
              )}
            </HudPanel>

            <HudPanel index="09" title="Twin overview" sub="All six measurements at a glance" grow>
              <div className="hud-overview">
                <div className="hud-ring" style={{ background: `conic-gradient(#36e3d6 0 ${(withinCount / METRICS.length) * 100}%, #12404c 0)` }}>
                  <div className="hud-ring-text">
                    {withinCount}/{METRICS.length}
                    <span className="hud-label">in range</span>
                  </div>
                </div>
                <div className="hud-rows">
                  {(["heart", "lungs", "body"] as Region[]).map((r) => (
                    <div key={r} className="hud-row">
                      <span>{REGION_LABEL[r]}</span>
                      <StatusTag status={state.regions[r]} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="hud-note">
                <div className="hud-gauge-top">
                  <span className="hud-label">Personal baseline</span>
                  <span className="hud-label hud-label-accent">
                    {state.baselineEstablished ? "Established" : `${restingSoFar} of ${BASELINE_MIN_READINGS} resting readings`}
                  </span>
                </div>
                <div className="hud-bar">
                  <i style={{ width: `${state.baselineEstablished ? 100 : (restingSoFar / BASELINE_MIN_READINGS) * 100}%` }} />
                </div>
                <p className="hud-label hud-note">{state.baselineEstablished ? "Readings are compared with your own usual range" : "Until then, default reference ranges are used"}</p>
              </div>
            </HudPanel>
          </div>
        </div>
      )}
    </HudShell>
  );
}
