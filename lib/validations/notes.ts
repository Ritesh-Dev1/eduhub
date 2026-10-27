import { z } from "zod";

export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const noteMetadataSchema = z.object({
  title: z
    .string()
    .min(2, "Title must be at least 2 characters")
    .max(150, "Title must not exceed 150 characters")
    .trim(),
  subject: z
    .string()
    .min(2, "Subject must be at least 2 characters")
    .max(100, "Subject must not exceed 100 characters")
    .trim(),
});

export type NoteMetadataInput = z.infer<typeof noteMetadataSchema>;
