"use client";

// The Cardiac advisor, for a doctor viewing a patient who shares with them.
//
// The workflow, top to bottom:
//   1. Parameters   the doctor reviews or enters the patient's cardiac values
//   2. Prediction   a model trained on the Cleveland data estimates heart disease
//   3. Suggestions  fixed rules list options; the doctor accepts or rejects each
//   4. Simulation   the doctor picks an intervention and the assumed changes;
//                   a second model compares ten-year risk before and after
//   5. Plan         the doctor adds notes and saves the reviewed session
//
// Every calculation happens on the server (/api/cardiac). This file only
// collects input and shows results. Nothing here diagnoses or prescribes.
import "./cardiac.css";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { HudPanel } from "@/components/hud/Hud";
import { ApiResult, apiError, callApi } from "@/lib/api/client";
import { startingAssumptions } from "@/lib/cardiac/assumptions";
import { Assessment, Assumptions, BAND_LABEL, CHOICES, CardiacInputs, CardiacSession, Intervention, ModelCard, Review, Simulation, Suggestion, interventionLabel } from "@/lib/cardiac/types";
import { PatientRecord, ageFrom, bmiFrom } from "@/lib/patient";
import { TwinState } from "@/lib/engine/types";
import { PredictionPanel, SuggestionsPanel } from "./CardiacResults";
import { AssumptionForm, WhatIfControls, WhatIfResult } from "./CardiacWhatIf";

type Key = keyof CardiacInputs;
type Form = Record<Key, string>;

interface Field {
  key: Key;
  label: string;
  choices?: readonly string[];
  min?: number;
  max?: number;
  step?: string;
}

const PATIENT_FIELDS: Field[] = [
  { key: "age", label: "Age (years)", min: 18, max: 100, step: "1" },
  { key: "sex", label: "Sex", choices: CHOICES.sex },
  { key: "trestbps", label: "Resting systolic pressure (mmHg)", min: 70, max: 250 },
  { key: "restingHr", label: "Resting heart rate (bpm)", min: 30, max: 200 },
  { key: "bmi", label: "BMI", min: 12, max: 60 },
  { key: "smoker", label: "Smokes", choices: CHOICES.smoker },
  { key: "chol", label: "Total cholesterol (mg/dL)", min: 80, max: 600 },
  { key: "fbs", label: "Fasting sugar above 120 mg/dL", choices: CHOICES.fbs },
];

const TEST_FIELDS: Field[] = [
  { key: "cp", label: "Chest pain type", choices: CHOICES.cp },
  { key: "restecg", label: "Resting ECG", choices: CHOICES.restecg },
  { key: "thalach", label: "Maximum heart rate in exercise test (bpm)", min: 50, max: 230 },
  { key: "exang", label: "Angina brought on by exercise", choices: CHOICES.exang },
  { key: "oldpeak", label: "ST depression in exercise (mm)", min: 0, max: 7 },
  { key: "slope", label: "ST slope at peak exercise", choices: CHOICES.slope },
  { key: "ca", label: "Major vessels seen on fluoroscopy", choices: CHOICES.ca },
  { key: "thal", label: "Thallium scan", choices: CHOICES.thal },
];

const ALL_FIELDS = [...PATIENT_FIELDS, ...TEST_FIELDS];

// Example values for demonstrations. Test results always come from here when
// the button is used; the patient's own values are kept where they exist.
const EXAMPLE_TESTS: Partial<Form> = { chol: "250", fbs: "0", cp: "3", restecg: "0", thalach: "150", exang: "0", oldpeak: "1.2", slope: "1", ca: "0", thal: "2" };
const EXAMPLE_IF_EMPTY: Partial<Form> = { age: "52", sex: "1", trestbps: "150", restingHr: "100", bmi: "27.5", smoker: "1" };

const EMPTY_FORM = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, ""])) as Form;
const FIRST_INTERVENTION: Intervention = { kind: "lifestyle", med: "bp" };

// What is already known about the patient: profile and latest twin reading.
function initialForm(record: PatientRecord, state: TwinState | null): Form {
  const form = { ...EMPTY_FORM };
  const age = ageFrom(record.profile?.dateOfBirth);
  const bmi = bmiFrom(record.profile);
  if (age !== null && age >= 18 && age <= 100) form.age = String(age);
  if (record.profile?.sex === "female") form.sex = "0";
  if (record.profile?.sex === "male") form.sex = "1";
  if (bmi !== null) form.bmi = bmi.toFixed(1);
  if (state) {
    form.trestbps = String(Math.round(state.metrics.sys.value));
    form.restingHr = String(Math.round(state.metrics.hr.value));
  }
  return form;
}

function toInputs(form: Form): CardiacInputs | null {
  const inputs = {} as Record<Key, number>;
  for (const field of ALL_FIELDS) {
    const value = Number(form[field.key]);
    if (form[field.key].trim() === "" || !Number.isFinite(value)) return null;
    inputs[field.key] = value;
  }
  return inputs;
}

function fromInputs(inputs: CardiacInputs): Form {
  return Object.fromEntries(ALL_FIELDS.map((field) => [field.key, String(inputs[field.key])])) as Form;
}

const toAssumptionForm = (a: Assumptions): AssumptionForm => ({
  sysChange: String(a.sysChange),
  cholChangePct: String(a.cholChangePct),
  hrChange: String(a.hrChange),
  bmiChange: String(a.bmiChange),
  stopSmoking: a.stopSmoking,
});

function toAssumptions(form: AssumptionForm): Assumptions | null {
  const numbers = [form.sysChange, form.cholChangePct, form.hrChange, form.bmiChange].map((value) => (value.trim() === "" ? NaN : Number(value)));
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  return { sysChange: numbers[0], cholChangePct: numbers[1], hrChange: numbers[2], bmiChange: numbers[3], stopSmoking: form.stopSmoking };
}

interface AssessAnswer extends ApiResult {
  assessment: Assessment;
  suggestions: Suggestion[];
}
interface SimulateAnswer extends ApiResult {
  simulation: Simulation;
}
interface ListAnswer extends ApiResult {
  sessions: CardiacSession[];
  models: { prediction: ModelCard; whatIf: ModelCard };
}

const percent = (risk: number) => `${(risk * 100).toFixed(1)}%`;
const when = (time: number) => new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function CardiacAdvisor({ user, patientId, record, state }: { user: User; patientId: string; record: PatientRecord; state: TwinState | null }) {
  const [form, setForm] = useState<Form>(() => initialForm(record, state));
  const [exampleValues, setExampleValues] = useState(false);
  const [inputs, setInputs] = useState<CardiacInputs | null>(null); // the values the results below were calculated from
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [intervention, setIntervention] = useState<Intervention>(FIRST_INTERVENTION);
  const [assumptions, setAssumptions] = useState<AssumptionForm>(() => toAssumptionForm(startingAssumptions(FIRST_INTERVENTION, 0)));
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<CardiacSession[] | null>(null);
  const [models, setModels] = useState<ListAnswer["models"] | null>(null);
  const [opened, setOpened] = useState<CardiacSession | null>(null);
  const [busy, setBusy] = useState<"" | "assess" | "simulate" | "save">("");
  const [error, setError] = useState<{ step: "assess" | "simulate" | "save" | "list"; text: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const loadSessions = useCallback(async () => {
    const answer = await callApi(user, "POST", "/api/cardiac", { action: "list", patientId });
    if (answer.ok) {
      const list = answer as ListAnswer;
      setSessions(list.sessions);
      setModels(list.models);
    } else {
      setSessions([]);
      setError({ step: "list", text: apiError(answer) });
    }
  }, [user, patientId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Any change to the parameters makes the results below out of date, so they are cleared.
  function clearResults() {
    setInputs(null);
    setAssessment(null);
    setSuggestions(null);
    setReviews({});
    setSimulation(null);
    setOpened(null);
    setSaved(false);
    setError(null);
  }

  function changeField(key: Key, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    clearResults();
  }

  function fillExample() {
    setForm((current) => {
      const next = { ...current, ...EXAMPLE_TESTS };
      for (const [key, value] of Object.entries(EXAMPLE_IF_EMPTY) as [Key, string][]) {
        if (next[key].trim() === "") next[key] = value;
      }
      return next;
    });
    setExampleValues(true);
    clearResults();
  }

  async function runPrediction(e: FormEvent) {
    e.preventDefault();
    const values = toInputs(form);
    if (!values) {
      setError({ step: "assess", text: "Fill in every field first." });
      return;
    }
    setBusy("assess");
    clearResults();
    const answer = await callApi(user, "POST", "/api/cardiac", { action: "assess", patientId, inputs: values });
    if (answer.ok) {
      const result = answer as AssessAnswer;
      setInputs(values);
      setAssessment(result.assessment);
      setSuggestions(result.suggestions);
      setAssumptions(toAssumptionForm(startingAssumptions(intervention, values.smoker)));
    } else {
      setError({ step: "assess", text: apiError(answer) });
    }
    setBusy("");
  }

  function review(id: string, value: Review) {
    setReviews((current) => {
      const next = { ...current };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });
    setSaved(false);
  }

  function changeIntervention(next: Intervention) {
    setIntervention(next);
    setAssumptions(toAssumptionForm(startingAssumptions(next, inputs?.smoker ?? 0)));
    setSimulation(null);
    setSaved(false);
  }

  function changeAssumptions(next: AssumptionForm) {
    setAssumptions(next);
    setSimulation(null);
    setSaved(false);
  }

  async function runSimulation() {
    const assumed = toAssumptions(assumptions);
    if (!inputs || !assumed) {
      setError({ step: "simulate", text: "Fill in every assumed change. Use 0 for no change." });
      return;
    }
    setBusy("simulate");
    setError(null);
    setSaved(false);
    const answer = await callApi(user, "POST", "/api/cardiac", { action: "simulate", patientId, inputs, assumptions: assumed });
    if (answer.ok) setSimulation((answer as SimulateAnswer).simulation);
    else setError({ step: "simulate", text: apiError(answer) });
    setBusy("");
  }

  async function savePlan() {
    const assumed = toAssumptions(assumptions);
    if (!inputs || !assumed || !simulation) return;
    setBusy("save");
    setError(null);
    const answer = await callApi(user, "POST", "/api/cardiac", { action: "save", patientId, inputs, assumptions: assumed, intervention, reviews, notes, exampleValues });
    if (answer.ok) {
      setSaved(true);
      await loadSessions();
    } else {
      setError({ step: "save", text: apiError(answer) });
    }
    setBusy("");
  }

  // Shows a saved session exactly as it was stored.
  function openSession(session: CardiacSession) {
    setForm(fromInputs(session.inputs));
    setExampleValues(session.exampleValues);
    setInputs(session.inputs);
    setAssessment(session.assessment);
    setSuggestions(session.suggestions);
    setReviews(session.reviews);
    setIntervention(session.intervention);
    setAssumptions(toAssumptionForm(session.assumptions));
    setSimulation(session.simulation);
    setNotes(session.notes);
    setOpened(session);
    setSaved(false);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = suggestions?.length ?? 0;
  const accepted = suggestions ? suggestions.filter((item) => reviews[item.id] === "accepted").length : 0;
  const rejected = suggestions ? suggestions.filter((item) => reviews[item.id] === "rejected").length : 0;
  const steps: [string, boolean][] = [
    ["Parameters", inputs !== null],
    ["Prediction", assessment !== null],
    ["Suggestions", total > 0 && accepted + rejected === total],
    ["Simulation", simulation !== null],
    ["Plan", saved || opened !== null],
  ];

  const field = (item: Field) => (
    <label key={item.key} className="hud-field">
      <span className="hud-label">{item.label}</span>
      {item.choices ? (
        <select className="hud-input" value={form[item.key]} onChange={(e) => changeField(item.key, e.target.value)} required>
          <option value="">Select</option>
          {item.choices.map((choice, code) => (
            <option key={choice} value={String(code)}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input className="hud-input" type="number" inputMode="decimal" min={item.min} max={item.max} step={item.step ?? "any"} value={form[item.key]} onChange={(e) => changeField(item.key, e.target.value)} required />
      )}
    </label>
  );

  return (
    <>
      <ol className="cx-steps" aria-label="Workflow">
        {steps.map(([label, done], index) => (
          <li key={label} className={done ? "cx-step cx-step-done" : "cx-step"}>
            <span>{index + 1}</span>
            {label}
            {done && <small>Done</small>}
          </li>
        ))}
      </ol>

      {opened && (
        <p className="hud-notice cx-flat">
          Showing the session saved on {when(opened.createdAt)}
          {opened.doctorName ? ` by ${opened.doctorName}` : ""}. Change any parameter to start a new one.
        </p>
      )}

      <HudPanel index="01" title="Cardiac parameters" sub="Prefilled from the profile and latest reading where known / Every value can be edited">
        <form onSubmit={runPrediction}>
          <p className="hud-label">Patient and risk factors</p>
          <div className="hud-form-grid cx-grid">{PATIENT_FIELDS.map(field)}</div>
          <p className="hud-label cx-subhead">Symptoms and test results</p>
          <div className="hud-form-grid cx-grid">{TEST_FIELDS.map(field)}</div>

          {state && <p className="hud-label hud-note">Pressure and heart rate start from the latest twin reading ({state.source}, {state.context}) / Change them if it was not taken at rest</p>}
          {exampleValues && <p className="hud-notice hud-note">Example values are in use. They are for demonstration and are not this patient's test results.</p>}
          {error?.step === "assess" && <p className="hud-error">{error.text}</p>}

          <div className="hud-actions">
            <button type="submit" disabled={busy !== ""} className="hud-btn hud-btn-solid hud-btn-large">
              {busy === "assess" ? "Running" : "Run prediction"}
            </button>
            <button type="button" onClick={fillExample} className="hud-btn hud-btn-quiet">
              Use example test results
            </button>
          </div>
        </form>
      </HudPanel>

      <div className="hud-two">
        <PredictionPanel inputs={inputs} assessment={assessment} card={models?.prediction ?? null} />
        <SuggestionsPanel suggestions={suggestions} reviews={reviews} onReview={review} />
      </div>

      <div className="hud-two">
        <WhatIfControls
          enabled={inputs !== null}
          smoker={inputs?.smoker === 1}
          intervention={intervention}
          assumptions={assumptions}
          busy={busy === "simulate"}
          error={error?.step === "simulate" ? error.text : ""}
          onIntervention={changeIntervention}
          onAssumption={changeAssumptions}
          onReset={() => changeIntervention(intervention)}
          onRun={runSimulation}
        />
        <WhatIfResult simulation={simulation} intervention={intervention} card={models?.whatIf ?? null} />
      </div>

      <HudPanel index="06" title="Reviewed plan" sub="The doctor's decisions and notes / Saved under this patient">
        {!assessment && <p className="hud-empty">The plan summary appears after the prediction.</p>}
        {assessment && (
          <div>
            <div className="cx-plain-row">
              <span>Model estimate</span>
              <span>
                {Math.round(assessment.probability * 100)}% / {BAND_LABEL[assessment.band]} band
              </span>
            </div>
            <div className="cx-plain-row">
              <span>Suggestions</span>
              <span>
                {accepted} accepted / {rejected} rejected / {total - accepted - rejected} not reviewed
              </span>
            </div>
            <div className="cx-plain-row">
              <span>Intervention explored</span>
              <span>{simulation ? interventionLabel(intervention) : "Not simulated yet"}</span>
            </div>
            {simulation && (
              <div className="cx-plain-row">
                <span>Ten-year estimate</span>
                <span>
                  {percent(simulation.baseline.risk)} baseline / {percent(simulation.simulated.risk)} simulated
                </span>
              </div>
            )}
            <label className="hud-field">
              <span className="hud-label">Plan notes: your decision, changes to the suggestions, follow-up</span>
              <textarea
                className="hud-input hud-textarea"
                maxLength={2000}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            {error?.step === "save" && <p className="hud-error">{error.text}</p>}
            {saved && <p className="hud-success">Session saved. It is listed below.</p>}
            <div className="hud-actions">
              <button type="button" onClick={savePlan} disabled={!simulation || busy !== "" || saved} className="hud-btn hud-btn-solid hud-btn-large">
                {busy === "save" ? "Saving" : "Save reviewed plan"}
              </button>
            </div>
            {!simulation && <p className="hud-label hud-note">Run the simulation before saving</p>}
            <p className="hud-label hud-note">Estimates and decision support only / Every clinical decision is the doctor's / Nothing here prescribes</p>
          </div>
        )}
      </HudPanel>

      <HudPanel index="07" title="Previous sessions" sub="Saved for this patient / Newest first">
        {error?.step === "list" && <p className="hud-error">{error.text}</p>}
        {!sessions && <p className="hud-empty">Loading sessions...</p>}
        {sessions && sessions.length === 0 && error?.step !== "list" && <p className="hud-empty">No saved sessions yet.</p>}
        {sessions?.map((session) => (
          <div key={session.id} className="cx-session">
            <div className="cx-session-main">
              <p className="cx-suggestion-title">
                {when(session.createdAt)}
                {session.doctorName ? ` / ${session.doctorName}` : ""}
              </p>
              <p className="hud-text cx-suggestion-reason">
                Estimate {Math.round(session.assessment.probability * 100)}% ({BAND_LABEL[session.assessment.band]}) / {interventionLabel(session.intervention)} / Ten-year {percent(session.simulation.baseline.risk)} to{" "}
                {percent(session.simulation.simulated.risk)}
                {session.exampleValues ? " / Example values" : ""}
              </p>
              {session.notes && <p className="hud-text cx-suggestion-reason">{session.notes}</p>}
            </div>
            <button type="button" onClick={() => openSession(session)} className="hud-btn hud-btn-quiet">
              Open
            </button>
          </div>
        ))}
      </HudPanel>
    </>
  );
}
