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
};

export const SOURCES: string[] = [
  "Diet, systolic pressure -5 mmHg: DASH trial (Appel et al., NEJM 1997) reported 5.5 mmHg on average.",
  "One blood-pressure medicine, -9 mmHg: Law et al., BMJ 2003, 354 trials, 9.1 mmHg on average at standard dose.",
  "One lipid-lowering medicine, total cholesterol -25%: Cochrane review of atorvastatin (2015) reported 26% to 38% across doses.",
];

// Allowed size of each assumed change.
export const LIMITS = { sysChange: -40, cholChangePct: -60, hrChange: -30, bmiChange: -8 };

export function startingAssumptions(intervention: Intervention, smoker: number): Assumptions {
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
