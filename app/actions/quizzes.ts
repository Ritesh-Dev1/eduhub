"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth/admin";
import {
  quizMetadataSchema,
  questionSchema,
  quizWithQuestionsSchema,
  type QuizMetadataInput,
  type QuestionInput,
  type QuizWithQuestionsInput,
} from "@/lib/validations/quiz";
import { safeAction, type ActionResult } from "@/lib/errors/safe-action";
import { AppError } from "@/lib/errors/app-error";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";

export type QuizStatus = "draft" | "open" | "live" | "closed";

export interface QuizListItem {
  id: string;
  title: string;
  status: QuizStatus;
  duration_minutes: number;
  countdown_seconds: number;
  start_at: string | null;
  show_score: boolean;
  created_at: string;
  question_count: number;
  total_marks: number;
}

export interface QuestionWithAdminAnswer extends QuestionInput {
  id: string;
}

export interface QuizAdminDetails {
  id: string;
  title: string;
  status: QuizStatus;
  duration_minutes: number;
  countdown_seconds: number;
  start_at: string | null;
  show_score: boolean;
  created_at: string;
  questions: QuestionWithAdminAnswer[];
}

export interface QuizCsvRowPreview {
  rowIndex: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  marks: number;
  isValid: boolean;
  errorMessage?: string;
}

// 1. Get Quizzes List (Public & Admin)
export async function getQuizzesAction(): Promise<ActionResult<{ quizzes: QuizListItem[] }>> {
  return safeAction("getQuizzesAction", async () => {
    const supabase = await createClient();

    // Fetch all quizzes
    const { data: quizzes, error: quizzesError } = await supabase
      .from("quizzes")
      .select("id, title, status, duration_minutes, countdown_seconds, start_at, show_score, created_at")
      .order("created_at", { ascending: false });

    if (quizzesError) throw quizzesError;
    if (!quizzes || quizzes.length === 0) {
      return { quizzes: [] };
    }

    // Fetch question counts and sum of marks per quiz
    // Using adminClient or public view to avoid exposing answers
    const adminClient = createAdminClient();
    const quizIds = quizzes.map((q) => q.id);

    const { data: questionsData, error: questionsError } = await adminClient
      .from("questions")
      .select("quiz_id, marks")
      .in("quiz_id", quizIds);

    if (questionsError) throw questionsError;

    const statsMap = new Map<string, { count: number; totalMarks: number }>();
    (questionsData || []).forEach((q) => {
      const current = statsMap.get(q.quiz_id) || { count: 0, totalMarks: 0 };
      current.count += 1;
      current.totalMarks += Number(q.marks || 1);
      statsMap.set(q.quiz_id, current);
    });

    const formatted: QuizListItem[] = quizzes.map((q) => {
      const stats = statsMap.get(q.id) || { count: 0, totalMarks: 0 };
      return {
        id: q.id,
        title: q.title,
        status: q.status as QuizStatus,
        duration_minutes: q.duration_minutes,
        countdown_seconds: q.countdown_seconds ?? 180,
        start_at: q.start_at,
        show_score: q.show_score ?? true,
        created_at: q.created_at,
        question_count: stats.count,
        total_marks: stats.totalMarks,
      };
    });

    return { quizzes: formatted };
  });
}

// 2. Get Single Quiz with Full Questions (Admin only)
export async function getQuizAdminDetailsAction(quizId: string): Promise<ActionResult<{ quiz: QuizAdminDetails }>> {
  return safeAction("getQuizAdminDetailsAction", async () => {
    await getCurrentAdmin();
    const adminClient = createAdminClient();

    const { data: quiz, error: quizError } = await adminClient
      .from("quizzes")
      .select("id, title, status, duration_minutes, countdown_seconds, start_at, show_score, created_at")
      .eq("id", quizId)
      .maybeSingle();

    if (quizError || !quiz) {
      throw new AppError("NOT_FOUND", "The requested quiz was not found.");
    }

    const { data: questions, error: questionsError } = await adminClient
      .from("questions")
      .select("id, question, option_a, option_b, option_c, option_d, correct_answer, marks, position")
      .eq("quiz_id", quizId)
      .order("position", { ascending: true });

    if (questionsError) throw questionsError;

    return {
      quiz: {
        ...quiz,
        status: quiz.status as QuizStatus,
        questions: (questions as QuestionWithAdminAnswer[]) || [],
      },
    };
  });
}

// 3. Create Quiz with Questions manually (Admin only)
export async function createQuizManualAction(payload: unknown): Promise<ActionResult<{ quizId: string }>> {
  return safeAction("createQuizManualAction", async () => {
    await getCurrentAdmin();
    const validated = quizWithQuestionsSchema.parse(payload);
    const adminClient = createAdminClient();

    // Insert Quiz
    const { data: quiz, error: quizError } = await adminClient
      .from("quizzes")
      .insert({
        title: validated.title,
        status: "draft",
        duration_minutes: validated.duration_minutes,
        countdown_seconds: validated.countdown_seconds,
        show_score: validated.show_score,
      })
      .select("id")
      .single();

    if (quizError || !quiz) throw quizError;

    // Insert Questions
    const questionsToInsert = validated.questions.map((q, idx) => ({
      quiz_id: quiz.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: q.marks,
      position: idx,
    }));

    const { error: questionsError } = await adminClient.from("questions").insert(questionsToInsert);
    if (questionsError) {
      // Rollback quiz
      await adminClient.from("quizzes").delete().eq("id", quiz.id);
      throw questionsError;
    }

    revalidatePath("/quizzes");
    revalidatePath("/admin/quizzes");

    return { quizId: quiz.id };
  });
}

// 4. Update Quiz with Questions (Admin only)
export async function updateQuizAction(quizId: string, payload: unknown): Promise<ActionResult<{ success: boolean }>> {
  return safeAction("updateQuizAction", async () => {
    await getCurrentAdmin();
    const validated = quizWithQuestionsSchema.parse(payload);
    const adminClient = createAdminClient();

    // Update Quiz Metadata
    const { error: quizError } = await adminClient
      .from("quizzes")
      .update({
        title: validated.title,
        duration_minutes: validated.duration_minutes,
        countdown_seconds: validated.countdown_seconds,
        show_score: validated.show_score,
      })
      .eq("id", quizId);

    if (quizError) throw quizError;

    // Replace Questions
    await adminClient.from("questions").delete().eq("quiz_id", quizId);

    const questionsToInsert = validated.questions.map((q, idx) => ({
      quiz_id: quizId,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: q.marks,
      position: idx,
    }));

    const { error: questionsError } = await adminClient.from("questions").insert(questionsToInsert);
    if (questionsError) throw questionsError;

    revalidatePath("/quizzes");
    revalidatePath("/admin/quizzes");

    return { success: true };
  });
}

// 5. Delete Quiz (Admin only, cascade to questions and attempts)
export async function deleteQuizAction(quizId: string): Promise<ActionResult<{ success: boolean }>> {
  return safeAction("deleteQuizAction", async () => {
    await getCurrentAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient.from("quizzes").delete().eq("id", quizId);
    if (error) throw error;

    revalidatePath("/quizzes");
    revalidatePath("/admin/quizzes");

    return { success: true };
  });
}

// 6. Preview & Validate Quiz Questions CSV
export async function previewQuizQuestionsCsvAction(csvContent: string): Promise<
  ActionResult<{
    previewRows: QuizCsvRowPreview[];
    totalRows: number;
    validCount: number;
    invalidCount: number;
  }>
> {
  return safeAction("previewQuizQuestionsCsvAction", async () => {
    await getCurrentAdmin();

    const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
      header: true,
      skipEmptyLines: "greedy",
    });

    if (parsed.errors && parsed.errors.length > 0) {
      const firstErr = parsed.errors[0];
      throw new AppError("CSV_PARSE_ERROR", `CSV formatting issue on row ${firstErr.row ?? 1}: ${firstErr.message}`);
    }

    const rows = parsed.data;
    if (!rows || rows.length === 0) {
      throw new AppError("VALIDATION_ERROR", "The provided CSV file contains no questions.");
    }

    // Verify headers: question, option_a, option_b, option_c, option_d, correct_answer, marks
    const sample = rows[0];
    const keys = Object.keys(sample).map((k) => k.trim().toLowerCase());
    const required = ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer"];
    const missing = required.filter((r) => !keys.includes(r));

    if (missing.length > 0) {
      throw new AppError(
        "CSV_PARSE_ERROR",
        `Invalid CSV headers. Missing required columns: ${missing.join(", ")}.`
      );
    }

    const previewRows: QuizCsvRowPreview[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2;

      const questionText = (row.question || "").trim();
      const optionA = (row.option_a || "").trim();
      const optionB = (row.option_b || "").trim();
      const optionC = (row.option_c || "").trim();
      const optionD = (row.option_d || "").trim();
      const rawAnswer = (row.correct_answer || "").trim().toLowerCase();
      const rawMarks = parseFloat(row.marks || "1");
      const marks = isNaN(rawMarks) || rawMarks <= 0 ? 1 : rawMarks;

      let isValid = true;
      let errorMessage: string | undefined;

      if (!questionText) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: question text is missing`;
      } else if (!optionA) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: option_a is missing`;
      } else if (!optionB) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: option_b is missing`;
      } else if (!optionC) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: option_c is missing`;
      } else if (!optionD) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: option_d is missing`;
      } else if (!["a", "b", "c", "d"].includes(rawAnswer)) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: correct_answer must be 'a', 'b', 'c', or 'd' (got "${rawAnswer}")`;
      }

      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }

      previewRows.push({
        rowIndex,
        question: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer: rawAnswer,
        marks,
        isValid,
        errorMessage,
      });
    }

    return {
      previewRows,
      totalRows: rows.length,
      validCount,
      invalidCount,
    };
  });
}

// 7. Create Quiz from CSV with questions
export async function createQuizFromCsvAction(payload: {
  title: string;
  duration_minutes: number;
  countdown_seconds: number;
  show_score: boolean;
  questions: Array<{
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: "a" | "b" | "c" | "d";
    marks: number;
  }>;
}): Promise<ActionResult<{ quizId: string }>> {
  return safeAction("createQuizFromCsvAction", async () => {
    await getCurrentAdmin();

    const validatedMetadata = quizMetadataSchema.parse({
      title: payload.title,
      duration_minutes: payload.duration_minutes,
      countdown_seconds: payload.countdown_seconds,
      show_score: payload.show_score,
    });

    if (!payload.questions || payload.questions.length === 0) {
      throw new AppError("VALIDATION_ERROR", "The quiz must contain at least one question.");
    }

    const adminClient = createAdminClient();

    // Insert Quiz
    const { data: quiz, error: quizError } = await adminClient
      .from("quizzes")
      .insert({
        title: validatedMetadata.title,
        status: "draft",
        duration_minutes: validatedMetadata.duration_minutes,
        countdown_seconds: validatedMetadata.countdown_seconds,
        show_score: validatedMetadata.show_score,
      })
      .select("id")
      .single();

    if (quizError || !quiz) throw quizError;

    // Insert Questions
    const questionsToInsert = payload.questions.map((q, idx) => ({
      quiz_id: quiz.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: q.marks,
      position: idx,
    }));

    const { error: questionsError } = await adminClient.from("questions").insert(questionsToInsert);
    if (questionsError) {
      await adminClient.from("quizzes").delete().eq("id", quiz.id);
      throw questionsError;
    }

    revalidatePath("/quizzes");
    revalidatePath("/admin/quizzes");

    return { quizId: quiz.id };
  });
}

// 8. Update Quiz Status (Draft -> Open -> "Approve & Start" -> Closed)
// All time logic uses server/DB clock (now())
export async function updateQuizStatusAction(
  quizId: string,
  newStatus: QuizStatus
): Promise<ActionResult<{ success: boolean; startAt?: string | null }>> {
  return safeAction("updateQuizStatusAction", async () => {
    await getCurrentAdmin();
    const adminClient = createAdminClient();

    const { data: existing, error: fetchError } = await adminClient
      .from("quizzes")
      .select("id, countdown_seconds")
      .eq("id", quizId)
      .maybeSingle();

    if (fetchError || !existing) {
      throw new AppError("NOT_FOUND", "The requested quiz was not found.");
    }

    const updateData: {
      status: QuizStatus;
      start_at?: string | null;
    } = {
      status: newStatus,
    };

    // When admin clicks "Approve & Start" (status transitions to 'live'):
    // Set start_at = DB now() + countdown_seconds * interval '1 second'
    if (newStatus === "live") {
      const countdownSec = existing.countdown_seconds || 180;
      // Calculate start_at from server clock
      const serverNow = new Date();
      const startAtDate = new Date(serverNow.getTime() + countdownSec * 1000);
      updateData.start_at = startAtDate.toISOString();
    } else if (newStatus === "draft" || newStatus === "open") {
      updateData.start_at = null;
    }

    const { error: updateError } = await adminClient
      .from("quizzes")
      .update(updateData)
      .eq("id", quizId);

    if (updateError) throw updateError;

    revalidatePath("/quizzes");
    revalidatePath("/admin/quizzes");
    revalidatePath(`/quizzes/${quizId}`);

    return {
      success: true,
      startAt: updateData.start_at,
    };
  });
}
