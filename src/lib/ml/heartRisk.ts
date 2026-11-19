// The ten-year risk model, as used by the what-if simulation.
//
// chdModel.json holds the numbers produced by ml/train_chd_model.py: a logistic
// regression trained on the Framingham Heart Study teaching data. This file
// applies those numbers. The same inputs always give the same answer, and it
// matches the Python model.
//
// What the model estimates: the chance that a person with these measurements
// develops coronary heart disease within ten years, as seen in that study.
// What it cannot do: say what any medicine or treatment will do to a patient.
// The data contains no outcomes after treatment.
import model from "./chdModel.json";
import { ModelCard } from "@/lib/cardiac/types";

export interface HeartInputs {
  age: number; // years
  male: number; // 1 = male, 0 = female
  sysBP: number; // systolic blood pressure, mmHg
  totChol: number; // total cholesterol, mg/dL
  BMI: number; // body mass index
  heartRate: number; // beats per minute
  currentSmoker: number; // 1 = smokes, 0 = does not
}

const LABEL: Record<keyof HeartInputs, string> = {
  age: "Age",
  male: "Sex",
  sysBP: "Systolic pressure",
  totChol: "Total cholesterol",
  BMI: "BMI",
  heartRate: "Heart rate",
  currentSmoker: "Smoking",
};

// Logistic regression: standardise each input, take the weighted sum, squash to 0..1.
export function predictRisk(inputs: HeartInputs): number {
  let z = model.intercept;
  model.features.forEach((feature, i) => {
    const value = inputs[feature as keyof HeartInputs];
    z += model.coef[i] * ((value - model.mean[i]) / model.scale[i]);
  });
  return 1 / (1 + Math.exp(-z));
}

// Inputs that fall outside the middle 98% of the people the model learned from.
// For these the estimate is an extrapolation and deserves less trust.
export function outsideTrainingRange(inputs: HeartInputs): string[] {
  const notes: string[] = [];
  const ranges = model.range as Record<string, number[]>;
  for (const feature of ["age", "sysBP", "totChol", "BMI", "heartRate"] as (keyof HeartInputs)[]) {
    const [low, high] = ranges[feature];
    const value = inputs[feature];
    if (value < low || value > high) {
      notes.push(`${LABEL[feature]} of ${Number(value.toFixed(1))} is outside the range the ten-year model learned from (${low} to ${high}).`);
    }
  }
  return notes;
}

export const FRAMINGHAM_CARD: ModelCard = {
  name: "Logistic regression",
  dataset: model.dataset,
  datasetUrl: model.datasetUrl,
  lines: [
    ["Predicts", "Coronary heart disease within ten years"],
    ["People", `${model.rows.used} (${model.rows.train} to train, ${model.rows.test} to test)`],
    ["Test AUC", model.metrics.testAuc.toFixed(2)],
    ["Cross-validated AUC", `${model.metrics.cvAucMean.toFixed(2)} ± ${model.metrics.cvAucSd.toFixed(2)}`],
  ],
};
