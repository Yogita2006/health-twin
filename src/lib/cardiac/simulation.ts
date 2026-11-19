// The what-if simulation: an illustrative comparison, not a prediction of how
// a patient will respond to treatment.
//
// How it works, in three plain steps:
//   1. The doctor picks an intervention.
//   2. The page fills in ASSUMED changes to the patient's readings. The doctor
//      can change every one of them. The starting values are rounded from
//      published trial averages (listed in SOURCES), not fitted to this patient.
//   3. A second model, trained on the Framingham Heart Study data, estimates
//      ten-year coronary heart disease risk for the readings before and after.
//
// Why a second model: the Cleveland model describes test findings such as the
// number of narrowed vessels. Treatment does not undo those, so it cannot
// answer a what-if question. The Framingham model works from risk factors.
//
// Limits that the page states next to every result: the changes are assumptions;
// the model compares different people in an observational study, which is not
// the same as changing one person's readings; and no dataset used here records
// what happened to patients after treatment.
import { HeartInputs, outsideTrainingRange, predictRisk } from "@/lib/ml/heartRisk";
import { Assumptions, CardiacInputs, SimulatedParams, Simulation } from "./types";

function riskInputs(x: CardiacInputs, p: SimulatedParams): HeartInputs {
  return { age: x.age, male: x.sex, sysBP: p.sys, totChol: p.chol, BMI: p.bmi, heartRate: p.hr, currentSmoker: p.smoker };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function simulate(x: CardiacInputs, assumptions: Assumptions): Simulation {
  const before: SimulatedParams = { sys: x.trestbps, chol: x.chol, hr: x.restingHr, bmi: round1(x.bmi), smoker: x.smoker };
  const after: SimulatedParams = {
    sys: round1(before.sys + assumptions.sysChange),
    chol: round1(before.chol * (1 + assumptions.cholChangePct / 100)),
    hr: round1(before.hr + assumptions.hrChange),
    bmi: round1(before.bmi + assumptions.bmiChange),
    smoker: assumptions.stopSmoking ? 0 : before.smoker,
  };
  const baselineInputs = riskInputs(x, before);
  const simulatedInputs = riskInputs(x, after);
  return {
    baseline: { params: before, risk: predictRisk(baselineInputs) },
    simulated: { params: after, risk: predictRisk(simulatedInputs) },
    warnings: [...new Set([...outsideTrainingRange(baselineInputs), ...outsideTrainingRange(simulatedInputs)])],
  };
}
