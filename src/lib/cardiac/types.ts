// Shapes shared by the Cardiac advisor page and its API route.

// What the doctor enters. The first thirteen are the columns of the Cleveland
// heart disease data, with the same codes. The last three are not in that data;
// they are needed by the what-if model and by the suggestion rules.
export interface CardiacInputs {
  age: number; // years
  sex: number; // 1 = male, 0 = female
  cp: number; // chest pain: 0 typical angina, 1 atypical angina, 2 non-anginal, 3 none
  trestbps: number; // resting systolic blood pressure, mmHg
  chol: number; // total cholesterol, mg/dL
  fbs: number; // fasting blood sugar above 120 mg/dL: 1 yes, 0 no
  restecg: number; // resting ECG: 0 normal, 1 ST-T abnormality, 2 left ventricular hypertrophy
  thalach: number; // highest heart rate reached in the exercise test, bpm
  exang: number; // angina brought on by exercise: 1 yes, 0 no
  oldpeak: number; // ST depression in exercise compared with rest, mm
  slope: number; // slope of the ST segment at peak exercise: 0 up, 1 flat, 2 down
  ca: number; // major vessels seen on fluoroscopy, 0 to 3
  thal: number; // thallium scan: 0 normal, 1 fixed defect, 2 reversible defect
  restingHr: number; // resting heart rate, bpm
  bmi: number; // body mass index
  smoker: number; // 1 = smokes, 0 = does not
}

export type RiskBand = "low" | "moderate" | "high";

// How one input moved the model's answer, compared with an average patient in the data.
export interface Contribution {
  key: string;
  label: string;
  value: string;
  effect: number; // in log-odds; above 0 raises the estimate, below 0 lowers it
}

export interface Assessment {
  probability: number; // 0..1, the model's estimate
  band: RiskBand;
  contributions: Contribution[]; // largest effect first
  warnings: string[];
}

export type SuggestionGroup = "lifestyle" | "consultation" | "medication" | "investigation";

export interface Suggestion {
  id: string;
  group: SuggestionGroup;
  title: string;
  reason: string; // the rule that produced it, in words
}

export type Review = "accepted" | "rejected";

export type InterventionKind = "accepted" | "lifestyle" | "medication" | "combination" | "referral";
export type MedCategory = "bp" | "lipid" | "both";

export interface Intervention {
  kind: InterventionKind;
  med: MedCategory; // used only by "medication" and "combination"
}

// The changes the doctor assumes the intervention would bring. All editable.
export interface Assumptions {
  sysChange: number; // mmHg, 0 or below
  cholChangePct: number; // per cent, 0 or below
  hrChange: number; // bpm, 0 or below
  bmiChange: number; // BMI points, 0 or below
  stopSmoking: boolean;
}

export interface SimulatedParams {
  sys: number;
  chol: number;
  hr: number;
  bmi: number;
  smoker: number;
}

export interface Simulation {
  baseline: { params: SimulatedParams; risk: number };
  simulated: { params: SimulatedParams; risk: number };
  warnings: string[];
}

export interface ModelCard {
  name: string;
  dataset: string;
  datasetUrl: string;
  lines: [string, string][]; // label, value
}

// One saved session, at patients/{patientId}/cardiac/{id}.
export interface CardiacSession {
  id: string;
  createdAt: number;
  doctorId: string;
  doctorName: string;
  exampleValues: boolean; // true when the example test results were used
  inputs: CardiacInputs;
  assessment: Assessment;
  suggestions: Suggestion[];
  reviews: Record<string, Review>;
  intervention: Intervention;
  assumptions: Assumptions;
  simulation: Simulation;
  notes: string;
}

export const BAND_LABEL: Record<RiskBand, string> = { low: "Low", moderate: "Moderate", high: "High" };

export const GROUP_LABEL: Record<SuggestionGroup, string> = {
  lifestyle: "Lifestyle",
  consultation: "Consultation",
  medication: "Medicine categories to consider",
  investigation: "Further investigations",
};

export const KIND_LABEL: Record<InterventionKind, string> = {
  accepted: "The suggestions I accepted",
  lifestyle: "Lifestyle modification",
  medication: "Medicine category chosen by the doctor",
  combination: "Lifestyle and medicine together",
  referral: "Referral for further cardiac evaluation",
};

export const MED_LABEL: Record<MedCategory, string> = {
  bp: "Blood-pressure-lowering",
  lipid: "Lipid-lowering",
  both: "Both categories",
};

export function interventionLabel(intervention: Intervention): string {
  const usesMed = intervention.kind === "medication" || intervention.kind === "combination";
  return usesMed ? `${KIND_LABEL[intervention.kind]} (${MED_LABEL[intervention.med].toLowerCase()})` : KIND_LABEL[intervention.kind];
}

// The choices behind each coded input, in code order.
export const CHOICES = {
  sex: ["Female", "Male"],
  cp: ["Typical angina", "Atypical angina", "Non-anginal pain", "No chest pain"],
  fbs: ["No", "Yes"],
  restecg: ["Normal", "ST-T wave abnormality", "Left ventricular hypertrophy"],
  exang: ["No", "Yes"],
  slope: ["Upsloping", "Flat", "Downsloping"],
  ca: ["0", "1", "2", "3"],
  thal: ["Normal", "Fixed defect", "Reversible defect"],
  smoker: ["No", "Yes"],
} as const;
