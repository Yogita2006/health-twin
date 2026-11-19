// Management options for the doctor to review. These are fixed rules, written
// below in plain view, not the output of a model. Each suggestion carries the
// rule that produced it. Nothing here prescribes: the doctor accepts or rejects
// every item, and medicine entries name a category to consider, never a drug or dose.
//
// The cut-offs are common textbook values: systolic pressure 130 and 140 mmHg,
// total cholesterol 200 and 240 mg/dL, BMI 25, fasting sugar above 120 mg/dL.
import { Assessment, CardiacInputs, Suggestion } from "./types";

export const CUTOFFS = { sysRaised: 130, sysHigh: 140, cholBorderline: 200, cholHigh: 240, bmiOverweight: 25, stDepression: 2 };

export function suggestionsFor(x: CardiacInputs, assessment: Assessment): Suggestion[] {
  const list: Suggestion[] = [];
  const add = (id: string, group: Suggestion["group"], title: string, reason: string) => list.push({ id, group, title, reason });

  // Lifestyle
  add("diet-activity", "lifestyle", "Heart-healthy diet, regular physical activity and stress management", "General advice, listed for every patient.");
  if (x.smoker === 1) add("smoking", "lifestyle", "Support to stop smoking", "Recorded as a current smoker.");
  if (x.bmi >= CUTOFFS.bmiOverweight) add("weight", "lifestyle", "Weight management", `BMI ${x.bmi.toFixed(1)} is ${CUTOFFS.bmiOverweight} or above.`);
  if (x.trestbps >= CUTOFFS.sysRaised) add("salt", "lifestyle", "Lower salt intake", `Resting pressure ${x.trestbps} mmHg is ${CUTOFFS.sysRaised} or above.`);

  // Consultation
  const findings: string[] = [];
  if (assessment.band === "high") findings.push("the model estimate is in the high band");
  if (x.cp === 0) findings.push("typical angina");
  if (x.exang === 1) findings.push("angina on exercise");
  if (x.oldpeak >= CUTOFFS.stDepression) findings.push(`ST depression of ${x.oldpeak} mm`);
  if (x.ca >= 1) findings.push(`${x.ca} vessel${x.ca > 1 ? "s" : ""} seen on fluoroscopy`);
  if (x.thal === 2) findings.push("a reversible defect on the thallium scan");
  if (findings.length > 0) add("cardiology", "consultation", "Cardiology consultation", `Because of: ${findings.join(", ")}.`);

  // Medicine categories. A category to consider, for the doctor to evaluate.
  if (x.trestbps >= CUTOFFS.sysHigh) add("bp-medicine", "medication", "Blood-pressure-lowering medicine", `Resting pressure ${x.trestbps} mmHg is ${CUTOFFS.sysHigh} or above.`);
  if (x.chol >= CUTOFFS.cholHigh) add("lipid-medicine", "medication", "Lipid-lowering medicine", `Total cholesterol ${x.chol} mg/dL is ${CUTOFFS.cholHigh} or above.`);

  // Further investigations
  if (x.trestbps >= CUTOFFS.sysHigh) add("bp-monitoring", "investigation", "Home or ambulatory blood-pressure monitoring", "A single raised reading should be confirmed.");
  if (x.chol >= CUTOFFS.cholBorderline) add("lipid-profile", "investigation", "Full fasting lipid profile", `Total cholesterol ${x.chol} mg/dL is ${CUTOFFS.cholBorderline} or above.`);
  if (x.fbs === 1) add("glucose", "investigation", "Diabetes assessment (HbA1c)", "Fasting blood sugar above 120 mg/dL.");
  if (x.restecg > 0) add("ecg", "investigation", "Repeat 12-lead ECG", "Resting ECG recorded as not normal.");
  if (x.restecg === 2 || assessment.band === "high") {
    add("echo", "investigation", "Echocardiography", x.restecg === 2 ? "Resting ECG suggests left ventricular hypertrophy." : "The model estimate is in the high band.");
  }

  return list;
}
