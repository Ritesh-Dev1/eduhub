import { z } from "zod";

export const quizMetadataSchema = z.object({
  title: z
    .string()
    .min(3, "Quiz title must be at least 3 characters")
    .max(150, "Quiz title must not exceed 150 characters")
    .trim(),
  duration_minutes: z
    .number()
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(300, "Duration must not exceed 300 minutes (5 hours)"),
  countdown_seconds: z
    .number()
    .int()
    .min(0, "Countdown cannot be negative")
    .max(600, "Countdown cannot exceed 10 minutes")
    .default(180),
  show_score: z.boolean().default(true),
});

export const questionSchema = z.object({
  id: z.string().optional(),
  question: z
    .string()
    .min(3, "Question text must be at least 3 characters")
    .trim(),
  option_a: z
    .string()
    .min(1, "Option A cannot be empty")
    .trim(),
  option_b: z
    .string()
    .min(1, "Option B cannot be empty")
    .trim(),
  option_c: z
    .string()
    .min(1, "Option C cannot be empty")
    .trim(),
  option_d: z
    .string()
    .min(1, "Option D cannot be empty")
    .trim(),
  correct_answer: z.enum(["a", "b", "c", "d"]),
  marks: z
    .number()
    .min(0.25, "Marks must be at least 0.25")
    .max(100, "Marks cannot exceed 100")
    .default(1),
  position: z.number().int().default(0),
});

export const quizWithQuestionsSchema = quizMetadataSchema.extend({
  questions: z
    .array(questionSchema)
    .min(1, "Quiz must contain at least one question"),
});

export type QuizMetadataInput = z.infer<typeof quizMetadataSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type QuizWithQuestionsInput = z.infer<typeof quizWithQuestionsSchema>;
