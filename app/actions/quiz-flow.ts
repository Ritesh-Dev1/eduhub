"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { safeAction, type ActionResult } from "@/lib/errors/safe-action";
import { AppError } from "@/lib/errors/app-error";
import { checkStudentVerifyRateLimit } from "@/lib/rate-limit/student-limiter";
import { getClientIp } from "@/lib/utils/get-ip";
import { revalidatePath } from "next/cache";

export interface StudentQuestionView {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
  position: number;
}

export interface JoinQuizResult {
  attemptId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  sessionToken: string;
  status: "waiting" | "countdown" | "in_progress" | "submitted" | "blocked";
  quizTitle: string;
  startAt: string | null;
  countdownSeconds: number;
  durationMinutes: number;
  showScore: boolean;
  score?: number | null;
}

// 1. Join Quiz or Check In as Student
export async function joinQuizAttemptAction(params: {
  quizId: string;
  name: string;
  rollNumber: string;
  clientToken: string;
}): Promise<ActionResult<JoinQuizResult>> {
  return safeAction("joinQuizAttemptAction", async () => {
    const ip = await getClientIp();

    // 1. Rate limit verification per IP
    checkStudentVerifyRateLimit(ip);

    const admin = createAdminClient();

    // 2. Verify quiz exists and is active
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, title, status, start_at, countdown_seconds, duration_minutes, show_score")
      .eq("id", params.quizId)
      .maybeSingle();

    if (quizError || !quiz) {
      throw new AppError("NOT_FOUND", "The requested quiz does not exist.");
    }

    if (quiz.status === "draft") {
      throw new AppError("FORBIDDEN", "This quiz has not been opened for students yet.");
    }

    // 3. Verify student against students table
    const cleanedName = params.name.trim();
    const cleanedRoll = params.rollNumber.trim();

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, name, roll_number")
      .ilike("roll_number", cleanedRoll)
      .maybeSingle();

    if (studentError || !student) {
      throw new AppError(
        "NOT_REGISTERED",
        "We couldn't find your details. Please check your name and roll number."
      );
    }

    // Check name similarity (case-insensitive substring or match)
    if (!student.name.toLowerCase().includes(cleanedName.toLowerCase()) &&
        !cleanedName.toLowerCase().includes(student.name.toLowerCase())) {
      throw new AppError(
        "NOT_REGISTERED",
        "We couldn't find your details. Please check your name and roll number."
      );
    }

    // 4. Check existing attempt for (quiz_id, student_id)
    const { data: existingAttempt } = await admin
      .from("attempts")
      .select("id, status, session_token, start_at:started_at, submitted_at, score")
      .eq("quiz_id", quiz.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (existingAttempt) {
      if (existingAttempt.status === "submitted") {
        return {
          attemptId: existingAttempt.id,
          studentId: student.id,
          studentName: student.name,
          rollNumber: student.roll_number,
          sessionToken: existingAttempt.session_token,
          status: "submitted",
          quizTitle: quiz.title,
          startAt: quiz.start_at,
          countdownSeconds: quiz.countdown_seconds ?? 180,
          durationMinutes: quiz.duration_minutes,
          showScore: quiz.show_score ?? true,
          score: existingAttempt.score,
        };
      }

      if (existingAttempt.status === "blocked") {
        return {
          attemptId: existingAttempt.id,
          studentId: student.id,
          studentName: student.name,
          rollNumber: student.roll_number,
          sessionToken: existingAttempt.session_token,
          status: "blocked",
          quizTitle: quiz.title,
          startAt: quiz.start_at,
          countdownSeconds: quiz.countdown_seconds ?? 180,
          durationMinutes: quiz.duration_minutes,
          showScore: quiz.show_score ?? true,
        };
      }

      // If attempt was already in_progress and user reconnects without active session:
      // Check if administrator authorized re-examination
      if (existingAttempt.status === "in_progress") {
        const { data: latestEvent } = await admin
          .from("attempt_events")
          .select("id, type, created_at")
          .eq("attempt_id", existingAttempt.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // If proctor authorized re-examination, let the student resume/restart seamlessly
        if (latestEvent?.type === "re_allowed") {
          await admin
            .from("attempts")
            .update({
              session_token: params.clientToken,
              last_heartbeat: new Date().toISOString(),
            })
            .eq("id", existingAttempt.id);

          await admin.from("attempt_events").insert({
            attempt_id: existingAttempt.id,
            type: "reconnected",
            reason: "Student entered authorized re-examination session.",
          });

          return {
            attemptId: existingAttempt.id,
            studentId: student.id,
            studentName: student.name,
            rollNumber: student.roll_number,
            sessionToken: params.clientToken,
            status: "in_progress",
            quizTitle: quiz.title,
            startAt: quiz.start_at,
            countdownSeconds: quiz.countdown_seconds ?? 180,
            durationMinutes: quiz.duration_minutes,
            showScore: quiz.show_score ?? true,
          };
        }

        // Standard anti-cheat: unexpected page reload during active exam
        await admin
          .from("attempts")
          .update({ status: "blocked" })
          .eq("id", existingAttempt.id);

        await admin.from("attempt_events").insert({
          attempt_id: existingAttempt.id,
          type: "blocked",
          reason: "Page was refreshed or reconnected during active examination.",
        });

        return {
          attemptId: existingAttempt.id,
          studentId: student.id,
          studentName: student.name,
          rollNumber: student.roll_number,
          sessionToken: existingAttempt.session_token,
          status: "blocked",
          quizTitle: quiz.title,
          startAt: quiz.start_at,
          countdownSeconds: quiz.countdown_seconds ?? 180,
          durationMinutes: quiz.duration_minutes,
          showScore: quiz.show_score ?? true,
        };
      }

      // If waiting or countdown: refresh session token and heartbeat
      await admin
        .from("attempts")
        .update({
          session_token: params.clientToken,
          last_heartbeat: new Date().toISOString(),
        })
        .eq("id", existingAttempt.id);

      return {
        attemptId: existingAttempt.id,
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.roll_number,
        sessionToken: params.clientToken,
        status: existingAttempt.status as "waiting" | "countdown",
        quizTitle: quiz.title,
        startAt: quiz.start_at,
        countdownSeconds: quiz.countdown_seconds ?? 180,
        durationMinutes: quiz.duration_minutes,
        showScore: quiz.show_score ?? true,
      };
    }

    // 5. Create new attempt
    const initialStatus = quiz.status === "live" ? "countdown" : "waiting";

    const { data: newAttempt, error: insertError } = await admin
      .from("attempts")
      .insert({
        quiz_id: quiz.id,
        student_id: student.id,
        status: initialStatus,
        session_token: params.clientToken,
        last_heartbeat: new Date().toISOString(),
      })
      .select("id, status")
      .single();

    if (insertError || !newAttempt) throw insertError;

    return {
      attemptId: newAttempt.id,
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.roll_number,
      sessionToken: params.clientToken,
      status: initialStatus,
      quizTitle: quiz.title,
      startAt: quiz.start_at,
      countdownSeconds: quiz.countdown_seconds ?? 180,
      durationMinutes: quiz.duration_minutes,
      showScore: quiz.show_score ?? true,
    };
  });
}

// 2. Fetch Questions & Saved Answers for Active Exam
// (RLS & Security Rule: correct_answer is NEVER sent to the client)
export async function getExamDataAction(params: {
  attemptId: string;
  sessionToken: string;
}): Promise<
  ActionResult<{
    questions: StudentQuestionView[];
    savedAnswers: Record<string, string>;
    startAt: string;
    durationMinutes: number;
    serverTime: string;
  }>
> {
  return safeAction("getExamDataAction", async () => {
    const admin = createAdminClient();

    // Verify attempt
    const { data: attempt, error: attemptError } = await admin
      .from("attempts")
      .select("id, quiz_id, status, session_token, started_at")
      .eq("id", params.attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      throw new AppError("NOT_FOUND", "Attempt session not found.");
    }

    if (attempt.session_token !== params.sessionToken) {
      throw new AppError("UNAUTHORIZED", "Invalid session token. Multiple tabs or devices detected.");
    }

    if (attempt.status === "blocked") {
      throw new AppError("QUIZ_BLOCKED", "You have been blocked. Contact admin.");
    }

    if (attempt.status === "submitted") {
      throw new AppError("ALREADY_SUBMITTED", "This exam has already been submitted.");
    }

    // Fetch quiz info
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, start_at, duration_minutes, status")
      .eq("id", attempt.quiz_id)
      .single();

    if (quizError || !quiz || !quiz.start_at) {
      throw new AppError("NOT_FOUND", "Quiz is not ready to start.");
    }

    // Verify that server clock has reached start_at
    const now = new Date();
    const startTime = new Date(quiz.start_at);
    if (now.getTime() < startTime.getTime()) {
      throw new AppError("FORBIDDEN", "The exam countdown is still active.");
    }

    // Update attempt status to in_progress if not already
    if (attempt.status !== "in_progress") {
      await admin
        .from("attempts")
        .update({
          status: "in_progress",
          started_at: attempt.started_at || now.toISOString(),
          last_heartbeat: now.toISOString(),
        })
        .eq("id", attempt.id);
    }

    // Fetch questions: explicitly omit correct_answer
    const { data: rawQuestions, error: questionsError } = await admin
      .from("questions")
      .select("id, question, option_a, option_b, option_c, option_d, marks, position")
      .eq("quiz_id", attempt.quiz_id)
      .order("position", { ascending: true });

    if (questionsError || !rawQuestions) {
      throw new AppError("INTERNAL_ERROR", "Could not load examination questions.");
    }

    // Fetch existing saved answers
    const { data: answersData } = await admin
      .from("answers")
      .select("question_id, selected_option")
      .eq("attempt_id", attempt.id);

    const savedAnswers: Record<string, string> = {};
    (answersData || []).forEach((ans) => {
      savedAnswers[ans.question_id] = ans.selected_option;
    });

    return {
      questions: rawQuestions as StudentQuestionView[],
      savedAnswers,
      startAt: quiz.start_at,
      durationMinutes: quiz.duration_minutes,
      serverTime: now.toISOString(),
    };
  });
}

// 3. Auto-Save Answer
export async function saveAnswerAction(params: {
  attemptId: string;
  sessionToken: string;
  questionId: string;
  selectedOption: string;
}): Promise<ActionResult<{ savedAt: string }>> {
  return safeAction("saveAnswerAction", async () => {
    const admin = createAdminClient();

    // Check attempt status and token
    const { data: attempt, error: attemptError } = await admin
      .from("attempts")
      .select("id, quiz_id, status, session_token")
      .eq("id", params.attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      throw new AppError("NOT_FOUND", "Attempt session not found.");
    }

    if (attempt.session_token !== params.sessionToken) {
      throw new AppError("UNAUTHORIZED", "Session token mismatch.");
    }

    if (attempt.status === "blocked") {
      throw new AppError("QUIZ_BLOCKED", "You have been blocked. Contact admin.");
    }

    if (attempt.status === "submitted") {
      throw new AppError("ALREADY_SUBMITTED", "This quiz has already been submitted.");
    }

    // Check time limit with server clock
    const { data: quiz } = await admin
      .from("quizzes")
      .select("start_at, duration_minutes")
      .eq("id", attempt.quiz_id)
      .single();

    if (quiz && quiz.start_at) {
      const examEndTime = new Date(quiz.start_at).getTime() + quiz.duration_minutes * 60 * 1000;
      // Allow 15-second grace period for network transit
      if (Date.now() > examEndTime + 15000) {
        throw new AppError("SESSION_EXPIRED", "The examination time limit has expired.");
      }
    }

    const nowIso = new Date().toISOString();

    // Upsert answer
    const { error: upsertError } = await admin.from("answers").upsert(
      {
        attempt_id: params.attemptId,
        question_id: params.questionId,
        selected_option: params.selectedOption.toLowerCase(),
        saved_at: nowIso,
      },
      { onConflict: "attempt_id,question_id" }
    );

    if (upsertError) throw upsertError;

    // Refresh heartbeat
    await admin
      .from("attempts")
      .update({ last_heartbeat: nowIso })
      .eq("id", params.attemptId);

    return { savedAt: nowIso };
  });
}

// 4. Session Heartbeat (Every 5 seconds)
export async function sendHeartbeatAction(params: {
  attemptId: string;
  sessionToken: string;
}): Promise<ActionResult<{ status: string; serverTime: string }>> {
  return safeAction("sendHeartbeatAction", async () => {
    const admin = createAdminClient();

    const { data: attempt, error } = await admin
      .from("attempts")
      .select("id, status, session_token")
      .eq("id", params.attemptId)
      .maybeSingle();

    if (error || !attempt) {
      throw new AppError("NOT_FOUND", "Session not found.");
    }

    if (attempt.session_token !== params.sessionToken) {
      return { status: "blocked", serverTime: new Date().toISOString() };
    }

    if (attempt.status === "blocked") {
      return { status: "blocked", serverTime: new Date().toISOString() };
    }

    const nowIso = new Date().toISOString();
    await admin
      .from("attempts")
      .update({ last_heartbeat: nowIso })
      .eq("id", params.attemptId);

    return {
      status: attempt.status,
      serverTime: nowIso,
    };
  });
}

// 5. Block Student Attempt (Anti-Cheat Event)
export async function blockAttemptAction(params: {
  attemptId: string;
  sessionToken: string;
  reason: string;
}): Promise<ActionResult<{ blocked: boolean }>> {
  return safeAction("blockAttemptAction", async () => {
    const admin = createAdminClient();

    const { data: attempt } = await admin
      .from("attempts")
      .select("id, status, session_token")
      .eq("id", params.attemptId)
      .maybeSingle();

    if (!attempt || attempt.status === "submitted") {
      return { blocked: false };
    }

    // Mark blocked
    await admin
      .from("attempts")
      .update({ status: "blocked" })
      .eq("id", params.attemptId);

    // Record event
    await admin.from("attempt_events").insert({
      attempt_id: params.attemptId,
      type: "blocked",
      reason: params.reason || "Anti-cheat violation detected",
    });

    revalidatePath("/admin/monitor");

    return { blocked: true };
  });
}

// 6. Submit Quiz & Compute Score on Server
export async function submitQuizAction(params: {
  attemptId: string;
  sessionToken: string;
}): Promise<
  ActionResult<{
    score: number;
    totalMarks: number;
    showScore: boolean;
  }>
> {
  return safeAction("submitQuizAction", async () => {
    const admin = createAdminClient();

    // Verify attempt
    const { data: attempt, error: attemptError } = await admin
      .from("attempts")
      .select("id, quiz_id, status, session_token, score")
      .eq("id", params.attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      throw new AppError("NOT_FOUND", "Attempt session not found.");
    }

    if (attempt.session_token !== params.sessionToken) {
      throw new AppError("UNAUTHORIZED", "Session token mismatch.");
    }

    if (attempt.status === "blocked") {
      throw new AppError("QUIZ_BLOCKED", "You have been blocked. Contact admin.");
    }

    // Fetch quiz info
    const { data: quiz, error: quizError } = await admin
      .from("quizzes")
      .select("id, show_score")
      .eq("id", attempt.quiz_id)
      .single();

    if (quizError || !quiz) {
      throw new AppError("NOT_FOUND", "Quiz details not found.");
    }

    // If already submitted, return previously computed score
    if (attempt.status === "submitted" && attempt.score !== null) {
      // Calculate total marks for reference
      const { data: questions } = await admin
        .from("questions")
        .select("marks")
        .eq("quiz_id", attempt.quiz_id);

      const totalMarks = (questions || []).reduce((acc, q) => acc + Number(q.marks || 1), 0);
      return {
        score: Number(attempt.score),
        totalMarks,
        showScore: quiz.show_score ?? true,
      };
    }

    // Fetch all questions with correct_answer on SERVER ONLY
    const { data: questions, error: questionsError } = await admin
      .from("questions")
      .select("id, correct_answer, marks")
      .eq("quiz_id", attempt.quiz_id);

    if (questionsError || !questions) {
      throw new AppError("INTERNAL_ERROR", "Could not calculate score.");
    }

    // Fetch all student answers
    const { data: studentAnswers } = await admin
      .from("answers")
      .select("question_id, selected_option")
      .eq("attempt_id", attempt.id);

    const answerMap = new Map<string, string>();
    (studentAnswers || []).forEach((a) => {
      answerMap.set(a.question_id, a.selected_option.toLowerCase());
    });

    let totalScore = 0;
    let totalMarks = 0;

    questions.forEach((q) => {
      const qMarks = Number(q.marks || 1);
      totalMarks += qMarks;
      const studentChoice = answerMap.get(q.id);
      if (studentChoice && studentChoice === q.correct_answer.toLowerCase()) {
        totalScore += qMarks;
      }
    });

    const nowIso = new Date().toISOString();

    // Mark attempt submitted
    const { error: updateError } = await admin
      .from("attempts")
      .update({
        status: "submitted",
        submitted_at: nowIso,
        score: totalScore,
      })
      .eq("id", attempt.id);

    if (updateError) throw updateError;

    revalidatePath("/admin/monitor");

    return {
      score: totalScore,
      totalMarks,
      showScore: quiz.show_score ?? true,
    };
  });
}

// 6. Check Live Attempt Status (Used by Blocked screen to auto-resume on Proctor Re-authorization)
export async function checkAttemptStatusAction(params: {
  attemptId: string;
  rollNumber?: string;
}): Promise<
  ActionResult<{
    status: "waiting" | "countdown" | "in_progress" | "submitted" | "blocked";
    sessionToken: string;
  }>
> {
  return safeAction("checkAttemptStatusAction", async () => {
    const admin = createAdminClient();

    const { data: attempt, error } = await admin
      .from("attempts")
      .select("id, status, session_token, student_id")
      .eq("id", params.attemptId)
      .maybeSingle();

    if (error || !attempt) {
      throw new AppError("NOT_FOUND", "Attempt session not found.");
    }

    if (params.rollNumber) {
      const { data: student } = await admin
        .from("students")
        .select("id, roll_number")
        .eq("id", attempt.student_id)
        .maybeSingle();

      if (
        !student ||
        student.roll_number.toLowerCase() !== params.rollNumber.trim().toLowerCase()
      ) {
        throw new AppError("UNAUTHORIZED", "Student credentials mismatch.");
      }
    }

    return {
      status: attempt.status as "waiting" | "countdown" | "in_progress" | "submitted" | "blocked",
      sessionToken: attempt.session_token,
    };
  });
}
