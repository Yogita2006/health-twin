// Checks everything the Cardiac advisor sends to the server.
import { z } from "zod";
import { LIMITS } from "@/lib/cardiac/assumptions";

const code = (max: number, label: string) => z.number().int(`${label} is not valid`).min(0, `${label} is not valid`).max(max, `${label} is not valid`);
const measure = (min: number, max: number, label: string) => z.number().min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`);

export const cardiacInputs = z.object({
  age: measure(18, 100, "Age").int("Age must be a whole number"),
  sex: code(1, "Sex"),
  cp: code(3, "Chest pain type"),
  trestbps: measure(70, 250, "Resting blood pressure"),
  chol: measure(80, 600, "Total cholesterol"),
  fbs: code(1, "Fasting blood sugar"),
  restecg: code(2, "Resting ECG"),
  thalach: measure(50, 230, "Maximum heart rate"),
  exang: code(1, "Exercise angina"),
  oldpeak: measure(0, 7, "ST depression"),
  slope: code(2, "ST slope"),
  ca: code(3, "Vessels on fluoroscopy"),
  thal: code(2, "Thallium scan"),
  restingHr: measure(30, 200, "Resting heart rate"),
  bmi: measure(12, 60, "BMI"),
  smoker: code(1, "Smoking"),
});

const change = (limit: number, label: string) => z.number().min(limit, `${label} cannot be below ${limit}`).max(0, `${label} must be 0 or a negative number`);

export const assumptionsInput = z.object({
  sysChange: change(LIMITS.sysChange, "Change in systolic pressure"),
  cholChangePct: change(LIMITS.cholChangePct, "Change in cholesterol"),
  hrChange: change(LIMITS.hrChange, "Change in resting heart rate"),
  bmiChange: change(LIMITS.bmiChange, "Change in BMI"),
  stopSmoking: z.boolean(),
});

export const interventionInput = z.object({
  kind: z.enum(["lifestyle", "medication", "combination", "referral"]),
  med: z.enum(["bp", "lipid", "both"]),
});

const patientId = z.string().min(1).max(128);

export const cardiacRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), patientId }),
  z.object({ action: z.literal("assess"), patientId, inputs: cardiacInputs }),
  z.object({ action: z.literal("simulate"), patientId, inputs: cardiacInputs, assumptions: assumptionsInput }),
  z.object({
    action: z.literal("save"),
    patientId,
    inputs: cardiacInputs,
    assumptions: assumptionsInput,
    intervention: interventionInput,
    reviews: z.record(z.string().max(40), z.enum(["accepted", "rejected"])),
    notes: z.string().max(2000, "Notes can be at most 2000 characters"),
    exampleValues: z.boolean(),
  }),
]);
