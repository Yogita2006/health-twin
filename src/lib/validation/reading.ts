import { z } from "zod";

// What the ingest API accepts. The limits are wide physical bounds whose only job
// is to reject nonsense (a heart rate of 900, a temperature of 5). They are not
// medical thresholds.
export const readingInput = z.object({
  context: z.enum(["resting", "active", "sleep"]),
  source: z.enum(["simulated", "manual"]),
  hr: z.number().min(20).max(250),
  sys: z.number().min(50).max(260),
  dia: z.number().min(30).max(160),
  spo2: z.number().min(50).max(100),
  tempC: z.number().min(30).max(45),
  rr: z.number().min(4).max(70),
});

export type ReadingInput = z.infer<typeof readingInput>;
