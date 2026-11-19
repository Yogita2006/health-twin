// Shapes and small helpers for patient records, shared by pages and API routes.

export type Sex = "female" | "male" | "other" | "undisclosed";
export const SEXES: Sex[] = ["female", "male", "other", "undisclosed"];
export const SEX_LABEL: Record<Sex, string> = { female: "Female", male: "Male", other: "Other", undisclosed: "Prefer not to say" };

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export interface PatientProfile {
  dateOfBirth: string; // "2001-05-17", or "" if not given
  sex: Sex;
  heightCm: number | null;
  weightKg: number | null;
  bloodGroup: string; // one of BLOOD_GROUPS, or "" if not given
}

// A doctor the patient has chosen to share their twin with.
export interface CareTeamMember {
  name: string;
  since: number;
}

// The document at patients/{uid}.
export interface PatientRecord {
  displayName: string;
  assignedDoctorIds: string[];
  careTeam?: Record<string, CareTeamMember>;
  profile?: PatientProfile;
}

export function ageFrom(dateOfBirth: string | undefined, now: number = Date.now()): number | null {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) return null;
  const today = new Date(now);
  let age = today.getFullYear() - year;
  const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hadBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// Body mass index: weight in kilograms divided by height in metres squared.
export function bmiFrom(profile: PatientProfile | undefined): number | null {
  if (!profile || !profile.heightCm || !profile.weightKg) return null;
  const metres = profile.heightCm / 100;
  return profile.weightKg / (metres * metres);
}

// One line such as "24 years / Female / 165 cm / 58 kg / O+".
export function profileSummary(profile: PatientProfile | undefined): string {
  if (!profile) return "Profile not filled in";
  const parts: string[] = [];
  const age = ageFrom(profile.dateOfBirth);
  if (age !== null) parts.push(`${age} years`);
  if (profile.sex !== "undisclosed") parts.push(SEX_LABEL[profile.sex]);
  if (profile.heightCm) parts.push(`${profile.heightCm} cm`);
  if (profile.weightKg) parts.push(`${profile.weightKg} kg`);
  if (profile.bloodGroup) parts.push(profile.bloodGroup);
  return parts.length ? parts.join(" / ") : "Profile not filled in";
}
