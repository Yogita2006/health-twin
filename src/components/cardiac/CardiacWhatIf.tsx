"use client";

// Step 4 of the Cardiac advisor: the what-if simulation.
// The doctor picks an intervention and sets the changes they assume it would
// bring. A second model then compares ten-year risk for the readings before
// and after. It is an illustration with stated assumptions, not a prediction
// of how this patient would respond.
import { FormEvent } from "react";
import { HudPanel } from "@/components/hud/Hud";
import { LIMITS, SOURCES } from "@/lib/cardiac/assumptions";
import { Intervention, InterventionKind, KIND_LABEL, MED_LABEL, MedCategory, ModelCard, Simulation, interventionLabel } from "@/lib/cardiac/types";
import { ModelRows } from "./CardiacResults";

// The assumption fields as typed, before they are turned into numbers.
export interface AssumptionForm {
  sysChange: string;
  cholChangePct: string;
  hrChange: string;
  bmiChange: string;
  stopSmoking: boolean;
}

const KINDS: InterventionKind[] = ["lifestyle", "medication", "combination", "referral"];
const MEDS: MedCategory[] = ["bp", "lipid", "both"];

const CHANGE_FIELDS: { key: "sysChange" | "cholChangePct" | "hrChange" | "bmiChange"; label: string }[] = [
  { key: "sysChange", label: "Systolic pressure change (mmHg)" },
  { key: "cholChangePct", label: "Total cholesterol change (%)" },
  { key: "hrChange", label: "Resting heart rate change (bpm)" },
  { key: "bmiChange", label: "BMI change (points)" },
];

interface ControlsProps {
  enabled: boolean;
  smoker: boolean;
  intervention: Intervention;
  assumptions: AssumptionForm;
  busy: boolean;
  error: string;
  onIntervention: (intervention: Intervention) => void;
  onAssumption: (assumptions: AssumptionForm) => void;
  onReset: () => void;
  onRun: () => void;
}

export function WhatIfControls({ enabled, smoker, intervention, assumptions, busy, error, onIntervention, onAssumption, onReset, onRun }: ControlsProps) {
  const usesMedicine = intervention.kind === "medication" || intervention.kind === "combination";

  function submit(e: FormEvent) {
    e.preventDefault();
    onRun();
  }

  return (
    <HudPanel index="04" title="What-if simulation" sub="Choose an intervention / Set the assumed changes">
      {!enabled && <p className="hud-empty">Run the prediction first.</p>}

      {enabled && (
        <form onSubmit={submit}>
          <div className="hud-form-grid">
            <label className="hud-field">
              <span className="hud-label">Hypothetical intervention</span>
              <select className="hud-input" value={intervention.kind} onChange={(e) => onIntervention({ ...intervention, kind: e.target.value as InterventionKind })}>
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </label>
            {usesMedicine && (
              <label className="hud-field">
                <span className="hud-label">Medicine category</span>
                <select className="hud-input" value={intervention.med} onChange={(e) => onIntervention({ ...intervention, med: e.target.value as MedCategory })}>
                  {MEDS.map((med) => (
                    <option key={med} value={med}>
                      {MED_LABEL[med]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <p className="hud-label cx-subhead">Assumed changes / Edit to your clinical judgement</p>
          <div className="hud-form-grid">
            {CHANGE_FIELDS.map((field) => (
              <label key={field.key} className="hud-field">
                <span className="hud-label">{field.label}</span>
                <input
                  className="hud-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={LIMITS[field.key]}
                  max={0}
                  value={assumptions[field.key]}
                  onChange={(e) => onAssumption({ ...assumptions, [field.key]: e.target.value })}
                  required
                />
              </label>
            ))}
            <label className="hud-field">
              <span className="hud-label">Stops smoking</span>
              <select className="hud-input" value={assumptions.stopSmoking ? "yes" : "no"} disabled={!smoker} onChange={(e) => onAssumption({ ...assumptions, stopSmoking: e.target.value === "yes" })}>
                <option value="no">{smoker ? "No" : "Does not smoke"}</option>
                {smoker && <option value="yes">Yes</option>}
              </select>
            </label>
          </div>

          {intervention.kind === "referral" && <p className="hud-text hud-note">A referral adds information. It does not change the readings by itself, so the starting values are all zero.</p>}
          {error && <p className="hud-error">{error}</p>}

          <div className="hud-actions">
            <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-large">
              {busy ? "Running" : "Run simulation"}
            </button>
            <button type="button" onClick={onReset} className="hud-btn hud-btn-quiet">
              Reset starting values
            </button>
          </div>

          <div className="cx-block">
            <p className="hud-label">Where the starting values come from</p>
            {SOURCES.map((source) => (
              <p key={source} className="hud-text cx-source">
                {source}
              </p>
            ))}
            <p className="hud-label hud-note">Averages across many people in trials / Not a prediction for this patient</p>
          </div>
        </form>
      )}
    </HudPanel>
  );
}

const percent = (risk: number) => `${(risk * 100).toFixed(1)}%`;

function signed(value: number, unit: string): string {
  if (Math.abs(value) < 0.05) return "No change";
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(1).replace(/\.0$/, "")}${unit}`;
}

export function WhatIfResult({ simulation, intervention, card }: { simulation: Simulation | null; intervention: Intervention; card: ModelCard | null }) {
  if (!simulation) {
    return (
      <HudPanel index="05" title="Before and after" sub="Estimated ten-year coronary heart disease risk">
        <p className="hud-empty">Run the simulation to compare the baseline with the assumed changes.</p>
      </HudPanel>
    );
  }

  const before = simulation.baseline;
  const after = simulation.simulated;
  const scaleMax = Math.max(0.2, Math.ceil(Math.max(before.risk, after.risk) * 10) / 10);
  const difference = (after.risk - before.risk) * 100;

  const rows: { label: string; unit: string; base: number; next: number }[] = [
    { label: "Systolic pressure", unit: " mmHg", base: before.params.sys, next: after.params.sys },
    { label: "Total cholesterol", unit: " mg/dL", base: before.params.chol, next: after.params.chol },
    { label: "Resting heart rate", unit: " bpm", base: before.params.hr, next: after.params.hr },
    { label: "BMI", unit: "", base: before.params.bmi, next: after.params.bmi },
  ];
  const smokingChanged = before.params.smoker !== after.params.smoker;

  return (
    <HudPanel index="05" title="Before and after" sub="Estimated ten-year coronary heart disease risk">
      <p className="hud-label">{interventionLabel(intervention)}</p>

      <div className="cx-risk">
        <div className="cx-risk-row">
          <span>Baseline</span>
          <span className="cx-track">
            <i className="cx-base" style={{ width: `${(before.risk / scaleMax) * 100}%` }} />
          </span>
          <b>{percent(before.risk)}</b>
        </div>
        <div className="cx-risk-row">
          <span>Simulated</span>
          <span className="cx-track">
            <i className="cx-next" style={{ width: `${(after.risk / scaleMax) * 100}%` }} />
          </span>
          <b>{percent(after.risk)}</b>
        </div>
        <p className="hud-label cx-scale">Bars run from 0 to {Math.round(scaleMax * 100)}%</p>
      </div>

      <p className="hud-text hud-note">
        {Math.abs(difference) < 0.05
          ? "The estimate does not change, because no reading was changed."
          : `The estimate is ${Math.abs(difference).toFixed(1)} percentage points ${difference < 0 ? "lower" : "higher"} for the simulated readings.`}
      </p>

      <div className="cx-block">
        <p className="hud-label">Readings: baseline and simulated</p>
        <div className="cx-compare cx-compare-head hud-label">
          <span>Reading</span>
          <span>Baseline</span>
          <span>Simulated</span>
          <span>Change</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="cx-compare">
            <span>{row.label}</span>
            <span>
              {row.base}
              {row.unit}
              <span className="cx-track cx-track-small">
                <i className="cx-base" style={{ width: "100%" }} />
              </span>
            </span>
            <span>
              {row.next}
              {row.unit}
              <span className="cx-track cx-track-small">
                <i className="cx-next" style={{ width: `${Math.max(0, Math.min(100, (row.next / row.base) * 100))}%` }} />
              </span>
            </span>
            <span>{signed(row.next - row.base, row.unit)}</span>
          </div>
        ))}
        <div className="cx-compare">
          <span>Smoking</span>
          <span>{before.params.smoker ? "Smokes" : "Does not smoke"}</span>
          <span>{after.params.smoker ? "Smokes" : "Does not smoke"}</span>
          <span>{smokingChanged ? "Stops" : "No change"}</span>
        </div>
        <p className="hud-label hud-note">Small bars show each simulated reading as a share of its baseline</p>
      </div>

      {simulation.warnings.map((warning) => (
        <p key={warning} className="hud-notice hud-note">
          {warning} Treat the estimate as an extrapolation.
        </p>
      ))}

      <div className="cx-block">
        <p className="hud-label">Possible benefit, uncertainty and limits</p>
        <ul className="cx-list hud-text">
          <li>Possible benefit: if the assumed changes were reached and held, the model places the patient in a lower-risk group. It says nothing about how likely the changes are.</li>
          <li>The changes are assumptions you set. They are not predictions of this patient's response to any medicine or programme.</li>
          <li>The model compares different people in an observational study. Changing one person's readings with treatment may not change risk by the same amount.</li>
          <li>None of the data used here records what happened to patients after treatment. Side effects, adherence and other conditions are not modelled.</li>
        </ul>
      </div>

      <ModelRows card={card} />
    </HudPanel>
  );
}
