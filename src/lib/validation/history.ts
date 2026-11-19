// What the server accepts for a medical history record.
import { z } from "zod";

const realDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && year >= 1900;
};
// Up to one year ahead is allowed, for planned surgeries and courses of treatment.
const notFarFuture = (value: string) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now() + 366 * 24 * 60 * 60 * 1000;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").refine(realDate, "Enter a real date").refine(notFarFuture, "The date is too far in the future");

export const historyInput = z
  .object({
    type: z.enum(["condition", "medication", "surgery", "allergy", "event"]),
    title: z.string().trim().min(1, "Enter a name").max(120, "The name is too long"),
    startDate: date,
    endDate: z.union([z.literal(""), date]),
    ongoing: z.boolean(),
    dosage: z.string().trim().max(60, "The dosage is too long"),
    frequency: z.string().trim().max(60, "The frequency is too long"),
    region: z.enum(["none", "heart", "lungs", "brain", "skeleton", "body"]),
    notes: z.string().trim().max(500, "Notes can be at most 500 characters"),
  })
  .refine((r) => r.ongoing || r.endDate === "" || r.endDate >= r.startDate, { message: "The end date cannot be before the start date" });

export const historyId = z.object({ id: z.string().min(1).max(64) });
