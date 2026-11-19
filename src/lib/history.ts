// Shapes and labels for a patient's medical history: conditions, medications,
// surgeries, allergies and other medical events. Shared by pages and the API.
import { Region } from "@/lib/engine/types";

export type HistoryType = "condition" | "medication" | "surgery" | "allergy" | "event";
export const HISTORY_TYPES: HistoryType[] = ["condition", "medication", "surgery", "allergy", "event"];

export const TYPE_LABEL: Record<HistoryType, string> = {
  condition: "Condition",
  medication: "Medication",
  surgery: "Surgery",
  allergy: "Allergy",
  event: "Treatment or event",
};

export const TYPE_PLURAL: Record<HistoryType, string> = {
  condition: "Conditions",
  medication: "Medications",
  surgery: "Surgeries",
  allergy: "Allergies",
  event: "Treatments and events",
};

// Short names for the filter buttons above the timeline.
export const TYPE_SHORT: Record<HistoryType, string> = {
  condition: "Conditions",
  medication: "Medications",
  surgery: "Surgeries",
  allergy: "Allergies",
  event: "Events",
};

// What "ongoing" and "past" are called for each kind of record.
export const STATUS_WORDS: Record<HistoryType, { ongoing: string; past: string }> = {
  condition: { ongoing: "Ongoing", past: "Resolved" },
  medication: { ongoing: "Ongoing", past: "Discontinued" },
  surgery: { ongoing: "Planned or recovering", past: "Completed" },
  allergy: { ongoing: "Active", past: "No longer active" },
  event: { ongoing: "Ongoing", past: "Completed" },
};

// What the name field asks for, per kind of record.
export const TITLE_HINT: Record<HistoryType, string> = {
  condition: "For example: Asthma",
  medication: "For example: Salbutamol inhaler",
  surgery: "For example: Appendix removal",
  allergy: "For example: Penicillin",
  event: "For example: Physiotherapy course",
};

export type HistoryRegion = Region | "none";
export const REGION_CHOICES: { id: HistoryRegion; label: string }[] = [
  { id: "none", label: "Not specific" },
  { id: "heart", label: "Heart" },
  { id: "lungs", label: "Lungs" },
  { id: "brain", label: "Brain" },
  { id: "skeleton", label: "Bones and joints" },
  { id: "body", label: "Whole body" },
];

// What is sent to the server when a record is added or changed.
export interface HistoryInput {
  type: HistoryType;
  title: string;
  startDate: string; // "2024-03-18"
  endDate: string; // "" while ongoing
  ongoing: boolean;
  dosage: string; // medications only, otherwise ""
  frequency: string; // medications only, otherwise ""
  region: HistoryRegion;
  notes: string;
}

// A stored record: patients/{uid}/history/{id}.
export interface HistoryRecord extends HistoryInput {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export const EMPTY_INPUT: HistoryInput = { type: "condition", title: "", startDate: "", endDate: "", ongoing: true, dosage: "", frequency: "", region: "none", notes: "" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2024-03-18" becomes "18 Mar 2024".
export function niceDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

// "18 Mar 2024 to present" or "18 Mar 2024 to 2 Apr 2024" or just the one date.
export function dateRange(record: HistoryInput): string {
  const start = niceDate(record.startDate);
  if (record.ongoing) return `${start} to present`;
  if (record.endDate && record.endDate !== record.startDate) return `${start} to ${niceDate(record.endDate)}`;
  return start;
}

export function statusWord(record: HistoryInput): string {
  return record.ongoing ? STATUS_WORDS[record.type].ongoing : STATUS_WORDS[record.type].past;
}

// Newest first, by the date each record started.
export function byNewest(a: HistoryRecord, b: HistoryRecord): number {
  return b.startDate.localeCompare(a.startDate) || b.createdAt - a.createdAt;
}
