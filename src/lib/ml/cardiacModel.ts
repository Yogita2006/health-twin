// The heart-disease prediction model, as used by the server.
//
// clevelandModel.json holds the numbers produced by ml/train_cardiac_model.py:
// a logistic regression trained on the Cleveland heart disease data. This file
// only applies those numbers. Nothing is random or made up: the same inputs
// always give the same answer, and the answer matches the Python model.
//
// What the model estimates: how closely a patient's findings resemble those of
// patients in the data who had heart disease on coronary angiography.
// What it is not: a diagnosis. The data is 297 patients from one hospital, all
// of whom had been referred for angiography.
import model from "./clevelandModel.json";
import { Assessment, CardiacInputs, CHOICES, Contribution, ModelCard, RiskBand } from "@/lib/cardiac/types";

// Display bands for the estimate. They split the scale into thirds so the page
// can show a word next to the number. They are not clinical cut-offs.
export const BANDS = { moderateFrom: 1 / 3, highFrom: 2 / 3 };

export function bandOf(probability: number): RiskBand {
  if (probability >= BANDS.highFrom) return "high";
  return probability >= BANDS.moderateFrom ? "moderate" : "low";
}

// The value of each model column for one patient. Categories become 1/0 columns,
// exactly as in the training script.
function columnValue(column: string, x: CardiacInputs): number {
  switch (column) {
    case "restecg_abnormal":
      return x.restecg > 0 ? 1 : 0;
    case "cp_1":
    case "cp_2":
    case "cp_3":
      return x.cp === Number(column.slice(3)) ? 1 : 0;
    case "slope_1":
    case "slope_2":
      return x.slope === Number(column.slice(6)) ? 1 : 0;
    case "thal_1":
    case "thal_2":
      return x.thal === Number(column.slice(5)) ? 1 : 0;
    default:
      return x[column as keyof CardiacInputs];
  }
}

// Which input each model column belongs to, with its label and how to show its value.
const GROUPS: { key: string; label: string; columns: string[]; show: (x: CardiacInputs) => string }[] = [
  { key: "age", label: "Age", columns: ["age"], show: (x) => `${x.age} years` },
  { key: "sex", label: "Sex", columns: ["sex"], show: (x) => CHOICES.sex[x.sex] },
  { key: "cp", label: "Chest pain type", columns: ["cp_1", "cp_2", "cp_3"], show: (x) => CHOICES.cp[x.cp] },
  { key: "trestbps", label: "Resting blood pressure", columns: ["trestbps"], show: (x) => `${x.trestbps} mmHg` },
  { key: "chol", label: "Total cholesterol", columns: ["chol"], show: (x) => `${x.chol} mg/dL` },
  { key: "fbs", label: "Fasting sugar above 120", columns: ["fbs"], show: (x) => CHOICES.fbs[x.fbs] },
  { key: "restecg", label: "Resting ECG", columns: ["restecg_abnormal"], show: (x) => CHOICES.restecg[x.restecg] },
  { key: "thalach", label: "Maximum heart rate", columns: ["thalach"], show: (x) => `${x.thalach} bpm` },
  { key: "exang", label: "Exercise angina", columns: ["exang"], show: (x) => CHOICES.exang[x.exang] },
  { key: "oldpeak", label: "ST depression", columns: ["oldpeak"], show: (x) => `${x.oldpeak} mm` },
  { key: "slope", label: "ST slope", columns: ["slope_1", "slope_2"], show: (x) => CHOICES.slope[x.slope] },
  { key: "ca", label: "Vessels on fluoroscopy", columns: ["ca"], show: (x) => String(x.ca) },
  { key: "thal", label: "Thallium scan", columns: ["thal_1", "thal_2"], show: (x) => CHOICES.thal[x.thal] },
];

const RANGE_LABEL: Record<string, string> = {
  age: "Age",
  trestbps: "Resting blood pressure",
  chol: "Total cholesterol",
  thalach: "Maximum heart rate",
  oldpeak: "ST depression",
};

// Logistic regression: standardise each column, take the weighted sum, squash to 0..1.
export function assess(inputs: CardiacInputs): Assessment {
  const effects: Record<string, number> = {};
  let z = model.intercept;
  model.columns.forEach((column, i) => {
    const effect = model.coef[i] * ((columnValue(column, inputs) - model.mean[i]) / model.scale[i]);
    effects[column] = effect;
    z += effect;
  });
  const probability = 1 / (1 + Math.exp(-z));

  // Each input's share of the answer, compared with an average patient in the data.
  const contributions: Contribution[] = GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    value: group.show(inputs),
    effect: group.columns.reduce((sum, column) => sum + effects[column], 0),
  })).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));

  // Values the model never saw during training make the estimate an extrapolation.
  const warnings: string[] = [];
  const ranges = model.ranges as Record<string, number[]>;
  for (const key of Object.keys(RANGE_LABEL)) {
    const [low, high] = ranges[key];
    const value = inputs[key as keyof CardiacInputs];
    if (value < low || value > high) warnings.push(`${RANGE_LABEL[key]} of ${value} is outside the values in the training data (${low} to ${high}).`);
  }

  return { probability, band: bandOf(probability), contributions, warnings };
}

const m = model.metrics;

export const CLEVELAND_CARD: ModelCard = {
  name: "Logistic regression",
  dataset: model.dataset,
  datasetUrl: model.datasetUrl,
  lines: [
    ["Predicts", "Heart disease on angiography"],
    ["Patients", `${model.rows.used} (${model.rows.train} to train, ${model.rows.test} to test)`],
    ["Cross-validated AUC", `${m.cvAucMean.toFixed(2)} ± ${m.cvAucSd.toFixed(2)}`],
    ["Test accuracy", `${m.testCounts.tp + m.testCounts.tn} of ${model.rows.test} (${Math.round(m.testAccuracy * 100)}%)`],
    ["Random forest, for comparison", `AUC ${m.forestCvAucMean.toFixed(2)} ± ${m.forestCvAucSd.toFixed(2)}`],
  ],
};
