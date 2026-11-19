// The assumed changes behind the what-if simulation. This file holds no model:
// it only says which starting values the page offers for each intervention.
// The doctor can change every one of them before running the simulation.
//
// The starting values are rounded from published trial averages, listed in
// SOURCES. They describe averages across many people in trials. They are not
// predictions of how this patient would respond.
import { Assumptions, Intervention } from "./types";

// Starting values, before the doctor edits them.
export const STARTING = {
  lifestyleSys: -5, // mmHg
  medicineSys: -9, // mmHg
  medicineCholPct: -25, // per cent
  weightBmi: -1, // BMI points
};

export const SOURCES: string[] = [
  "Diet, systolic pressure -5 mmHg: DASH trial (Appel et al., NEJM 1997) reported 5.5 mmHg on average.",
  "One blood-pressure medicine, -9 mmHg: Law et al., BMJ 2003, 354 trials, 9.1 mmHg on average at standard dose.",
  "One lipid-lowering medicine, total cholesterol -25%: Cochrane review of atorvastatin (2015) reported 26% to 38% across doses.",
  "Weight management, BMI -1 point: a round illustrative value with no trial behind it.",
];

// What each accepted suggestion adds to the assumed changes. Suggestions that
// are not listed here (consultation, investigations) change no reading.
// Diet and salt are counted once between them, as one change of diet.
export const ACCEPTED_EFFECTS: { ids: string[]; label: string; apply: (a: Assumptions) => void }[] = [
  { ids: ["diet-activity", "salt"], label: `Diet: systolic pressure ${STARTING.lifestyleSys} mmHg`, apply: (a) => (a.sysChange += STARTING.lifestyleSys) },
  { ids: ["bp-medicine"], label: `Blood-pressure-lowering medicine: systolic pressure ${STARTING.medicineSys} mmHg`, apply: (a) => (a.sysChange += STARTING.medicineSys) },
  { ids: ["lipid-medicine"], label: `Lipid-lowering medicine: total cholesterol ${STARTING.medicineCholPct}%`, apply: (a) => (a.cholChangePct += STARTING.medicineCholPct) },
  { ids: ["weight"], label: `Weight management: BMI ${STARTING.weightBmi} point`, apply: (a) => (a.bmiChange += STARTING.weightBmi) },
  { ids: ["smoking"], label: "Support to stop smoking: stops smoking", apply: (a) => (a.stopSmoking = true) },
];

// The effects that apply to a set of accepted suggestion ids.
export function effectsOf(acceptedIds: string[]) {
  return ACCEPTED_EFFECTS.filter((effect) => effect.ids.some((id) => acceptedIds.includes(id)));
}

// Allowed size of each assumed change.
export const LIMITS = { sysChange: -40, cholChangePct: -60, hrChange: -30, bmiChange: -8 };

export function startingAssumptions(intervention: Intervention, smoker: number, acceptedIds: string[] = []): Assumptions {
  if (intervention.kind === "accepted") {
    const assumed: Assumptions = { sysChange: 0, cholChangePct: 0, hrChange: 0, bmiChange: 0, stopSmoking: false };
    for (const effect of effectsOf(acceptedIds)) effect.apply(assumed);
    if (smoker !== 1) assumed.stopSmoking = false;
    return assumed;
  }
  const lifestyle = intervention.kind === "lifestyle" || intervention.kind === "combination";
  const medicine = intervention.kind === "medication" || intervention.kind === "combination";
  const bp = medicine && intervention.med !== "lipid";
  const lipid = medicine && intervention.med !== "bp";
  return {
    sysChange: (lifestyle ? STARTING.lifestyleSys : 0) + (bp ? STARTING.medicineSys : 0),
    cholChangePct: lipid ? STARTING.medicineCholPct : 0,
    hrChange: 0,
    bmiChange: 0,
    stopSmoking: lifestyle && smoker === 1,
  };
}
