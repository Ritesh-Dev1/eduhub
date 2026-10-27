import { z } from "zod";

export const studentSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .trim(),
  roll_number: z
    .string()
    .min(1, "Roll number is required")
    .max(50, "Roll number must not exceed 50 characters")
    .trim(),
});

export type StudentInput = z.infer<typeof studentSchema>;
