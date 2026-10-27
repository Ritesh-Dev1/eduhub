"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { safeAction, type ActionResult } from "@/lib/errors/safe-action";
import { AppError } from "@/lib/errors/app-error";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";

export interface StudentAttemptMonitorItem {
  id: string;
  studentId: string;
  name: string;
  roll_number: string;
  status: "waiting" | "countdown" | "in_progress" | "submitted" | "blocked";
  last_heartbeat: string;
  started_at: string | null;
  submitted_at: string | null;
  score: number | null;
  times_blocked: number;
  timeLeftSeconds?: number;
}

export interface MonitorSummary {
  registered: number;
  attempted: number;
  inProgress: number;
  submitted: number;
  blocked: number;
  averageScore: number;
  totalMarks: number;
}

// 1. Fetch live monitor data for a quiz
export async function getLiveMonitorDataAction(quizId: string): Promise<
  ActionResult<{
    quizTitle: string;
    quizStatus: string;
    durationMinutes: number;
    startAt: string | null;
    attempts: StudentAttemptMonitorItem[];
    summary: MonitorSummary;
  }>
> {
  return safeAction("getLiveMonitorDataAction", async () => {
    await getCurrentAdmin();
    const admin = createAdminClient();

    // Fetch Quiz
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, title, status, duration_minutes, start_at")
      .eq("id", quizId)
      .maybeSingle();

    if (quizError || !quiz) {
      throw new AppError("NOT_FOUND", "Quiz not found.");
    }

    // Fetch Total Registered Students Count
    const { count: registeredCount } = await admin
      .from("students")
      .select("id", { count: "exact", head: true });

    // Fetch Total Marks of Questions
    const { data: questionsData } = await admin
      .from("questions")
      .select("marks")
      .eq("quiz_id", quizId);

    const totalMarks = (questionsData || []).reduce((acc, q) => acc + Number(q.marks || 1), 0);

    // Fetch Attempts with Students
    const { data: attemptsData, error: attemptsError } = await admin
      .from("attempts")
      .select(`
        id,
        quiz_id,
        student_id,
        status,
        session_token,
        last_heartbeat,
        started_at,
        submitted_at,
        score,
        created_at,
        students (
          id,
          name,
          roll_number
        )
      `)
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false });

    if (attemptsError) throw attemptsError;

    // Fetch block events count per attempt
    const attemptIds = (attemptsData || []).map((a) => a.id);
    const { data: eventsData } = await admin
      .from("attempt_events")
      .select("attempt_id, type")
      .in("attempt_id", attemptIds)
      .eq("type", "blocked");

    const blockCountMap = new Map<string, number>();
    (eventsData || []).forEach((ev) => {
      blockCountMap.set(ev.attempt_id, (blockCountMap.get(ev.attempt_id) || 0) + 1);
    });

    const now = Date.now();
    let inProgressCount = 0;
    let submittedCount = 0;
    let blockedCount = 0;
    let scoreSum = 0;

    const formattedAttempts: StudentAttemptMonitorItem[] = (attemptsData || []).map((att) => {
      const student = att.students as unknown as { id: string; name: string; roll_number: string } | null;

      if (att.status === "in_progress") inProgressCount++;
      if (att.status === "submitted") {
        submittedCount++;
        scoreSum += Number(att.score || 0);
      }
      if (att.status === "blocked") blockedCount++;

      let timeLeftSeconds: number | undefined;
      if (att.status === "in_progress" && quiz.start_at) {
        const endTime = new Date(quiz.start_at).getTime() + quiz.duration_minutes * 60 * 1000;
        timeLeftSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
      }

      return {
        id: att.id,
        studentId: student?.id || att.student_id,
        name: student?.name || "Unknown",
        roll_number: student?.roll_number || "—",
        status: att.status as StudentAttemptMonitorItem["status"],
        last_heartbeat: att.last_heartbeat,
        started_at: att.started_at,
        submitted_at: att.submitted_at,
        score: att.score !== null ? Number(att.score) : null,
        times_blocked: blockCountMap.get(att.id) || 0,
        timeLeftSeconds,
      };
    });

    const averageScore =
      submittedCount > 0 ? parseFloat((scoreSum / submittedCount).toFixed(2)) : 0;

    return {
      quizTitle: quiz.title,
      quizStatus: quiz.status,
      durationMinutes: quiz.duration_minutes,
      startAt: quiz.start_at,
      attempts: formattedAttempts,
      summary: {
        registered: registeredCount || 0,
        attempted: formattedAttempts.length,
        inProgress: inProgressCount,
        submitted: submittedCount,
        blocked: blockedCount,
        averageScore,
        totalMarks,
      },
    };
  });
}

// 2. Allow Re-Exam for a Blocked Student (Resume or Restart)
export async function allowReExamAction(params: {
  attemptId: string;
  mode: "resume" | "restart";
  reason?: string;
}): Promise<ActionResult<{ success: boolean }>> {
  return safeAction("allowReExamAction", async () => {
    await getCurrentAdmin();
    const admin = createAdminClient();

    const { data: attempt, error: fetchError } = await admin
      .from("attempts")
      .select("id, quiz_id, status")
      .eq("id", params.attemptId)
      .maybeSingle();

    if (fetchError || !attempt) {
      throw new AppError("NOT_FOUND", "Attempt record not found.");
    }

    const newSessionToken = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    if (params.mode === "restart") {
      // Clear answers
      await admin.from("answers").delete().eq("attempt_id", attempt.id);

      // Reset attempt status and session
      await admin
        .from("attempts")
        .update({
          status: "in_progress",
          session_token: newSessionToken,
          started_at: nowIso,
          submitted_at: null,
          score: null,
          last_heartbeat: nowIso,
        })
        .eq("id", attempt.id);
    } else {
      // Resume: unblock, keep answers and remaining time
      await admin
        .from("attempts")
        .update({
          status: "in_progress",
          session_token: newSessionToken,
          last_heartbeat: nowIso,
        })
        .eq("id", attempt.id);
    }

    // Log re-allow event
    await admin.from("attempt_events").insert({
      attempt_id: attempt.id,
      type: "re_allowed",
      reason:
        params.reason ||
        `Administrator authorized re-examination (${params.mode.toUpperCase()} mode)`,
    });

    revalidatePath("/admin/monitor");

    return { success: true };
  });
}

// 3. Export Quiz Results to CSV (Admin only, generated on server)
export async function exportQuizResultsCsvAction(quizId: string): Promise<
  ActionResult<{
    csvContent: string;
    filename: string;
  }>
> {
  return safeAction("exportQuizResultsCsvAction", async () => {
    await getCurrentAdmin();
    const admin = createAdminClient();

    // Fetch quiz info
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("title")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      throw new AppError("NOT_FOUND", "Quiz not found.");
    }

    // Fetch Total Marks
    const { data: questions } = await admin
      .from("questions")
      .select("marks")
      .eq("quiz_id", quizId);

    const totalMarks = (questions || []).reduce((acc, q) => acc + Number(q.marks || 1), 0);

    // Fetch attempts
    const { data: attempts, error: attemptsError } = await admin
      .from("attempts")
      .select(`
        id,
        score,
        submitted_at,
        students (
          name,
          roll_number
        )
      `)
      .eq("quiz_id", quizId)
      .order("score", { ascending: false });

    if (attemptsError) throw attemptsError;

    // Fetch block events
    const attemptIds = (attempts || []).map((a) => a.id);
    const { data: events } = await admin
      .from("attempt_events")
      .select("attempt_id")
      .in("attempt_id", attemptIds)
      .eq("type", "blocked");

    const blockCountMap = new Map<string, number>();
    (events || []).forEach((ev) => {
      blockCountMap.set(ev.attempt_id, (blockCountMap.get(ev.attempt_id) || 0) + 1);
    });

    const csvRows = (attempts || []).map((a) => {
      const student = a.students as unknown as { name: string; roll_number: string } | null;
      const scoreNum = a.score !== null ? Number(a.score) : 0;
      const percentage = totalMarks > 0 ? ((scoreNum / totalMarks) * 100).toFixed(1) + "%" : "0%";

      return {
        name: student?.name || "Unknown",
        roll_number: student?.roll_number || "—",
        score: scoreNum,
        total: totalMarks,
        percentage,
        submitted_at: a.submitted_at
          ? new Date(a.submitted_at).toLocaleString()
          : "Not Submitted",
        times_blocked: blockCountMap.get(a.id) || 0,
      };
    });

    const csvContent = Papa.unparse(csvRows, {
      columns: [
        "name",
        "roll_number",
        "score",
        "total",
        "percentage",
        "submitted_at",
        "times_blocked",
      ],
    });

    const safeTitle = quiz.title.replace(/[^a-zA-Z0-9-_]/g, "_");
    const filename = `Results_${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`;

    return {
      csvContent,
      filename,
    };
  });
}
