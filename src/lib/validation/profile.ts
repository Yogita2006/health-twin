// What the server accepts when someone saves their profile, links a doctor,
// or (as an admin) changes a role. Anything outside these shapes is rejected.
import { z } from "zod";

const isRealPastDate = (value: string) => {
  if (value === "") return true;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real && year >= 1900 && date.getTime() <= Date.now();
};

export const profileInput = z.object({
  displayName: z.string().trim().min(1, "Enter a name").max(80, "Name is too long"),
  dateOfBirth: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use the date picker")
    .refine(isRealPastDate, "Enter a real date that is not in the future"),
  sex: z.enum(["female", "male", "other", "undisclosed"]),
  heightCm: z.number().min(30, "Height must be at least 30 cm").max(250, "Height must be at most 250 cm").nullable(),
  weightKg: z.number().min(1, "Weight must be at least 1 kg").max(400, "Weight must be at most 400 kg").nullable(),
  bloodGroup: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
});

export const nameInput = z.object({
  displayName: z.string().trim().min(1, "Enter a name").max(80, "Name is too long"),
});

// Used both to start and to stop sharing with a doctor.
export const doctorInput = z.object({
  doctorId: z.string().min(1).max(128),
});

export const adminSignupInput = z.object({
  displayName: z.string().trim().min(1, "Enter a name").max(80, "Name is too long"),
  key: z.string().min(1, "Enter the admin key").max(200),
});

export const roleInput = z.object({
  uid: z.string().min(1).max(128),
  role: z.enum(["patient", "doctor", "admin"]),
});
