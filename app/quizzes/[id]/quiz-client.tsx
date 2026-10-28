"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  joinQuizAttemptAction,
  getExamDataAction,
  saveAnswerAction,
  sendHeartbeatAction,
  blockAttemptAction,
  submitQuizAction,
  checkAttemptStatusAction,
  type StudentQuestionView,
} from "@/app/actions/quiz-flow";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Send,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

interface QuizClientProps {
  quizId: string;
}

type QuizPhase = "REGISTER" | "WAITING" | "COUNTDOWN" | "EXAM" | "SUBMITTED" | "BLOCKED";

export function QuizClient({ quizId }: QuizClientProps) {
  const [phase, setPhase] = useState<QuizPhase>("REGISTER");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Student details
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [attemptId, setAttemptId] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string>("");

  // Quiz info
  const [quizTitle, setQuizTitle] = useState("");
  const [startAt, setStartAt] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [showScore, setShowScore] = useState(true);

  // Countdown & Exam Timer
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const [examRemainingSeconds, setExamRemainingSeconds] = useState<number>(0);

  // Exam Questions & Answers
  const [questions, setQuestions] = useState<StudentQuestionView[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Connection drop tracking
  const [connectionLost, setConnectionLost] = useState(false);

  // Submit modal & score state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [totalMarks, setTotalMarks] = useState<number>(0);

  // Anti-cheat refs
  const hasTriggeredBlockRef = useRef(false);
  const canTriggerBlurRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger Anti-Cheat Block
  const triggerBlock = useCallback(
    async (reason: string) => {
      if (hasTriggeredBlockRef.current) return;
      hasTriggeredBlockRef.current = true;
      setPhase("BLOCKED");

      try {
        if (attemptId && sessionToken) {
          await blockAttemptAction({
            attemptId,
            sessionToken,
            reason,
          });
        }
      } catch {
        // Safe failover
      }
    },
    [attemptId, sessionToken]
  );

  // 1. Student Registration & Join
  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setConnectionLost(false);

    const newSessionToken = crypto.randomUUID();

    try {
      const res = await joinQuizAttemptAction({
        quizId,
        name: studentName,
        rollNumber,
        clientToken: newSessionToken,
      });

      if (!res.ok) {
        setErrorMessage(res.message);
        return;
      }

      const data = res.data;
      setAttemptId(data.attemptId);
      setSessionToken(data.sessionToken);
      setQuizTitle(data.quizTitle);
      setStartAt(data.startAt);
      setDurationMinutes(data.durationMinutes);
      setShowScore(data.showScore);

      if (data.status === "blocked") {
        setPhase("BLOCKED");
      } else if (data.status === "submitted") {
        setFinalScore(data.score ?? null);
        setPhase("SUBMITTED");
      } else if (data.startAt) {
        const diffMs = new Date(data.startAt).getTime() - Date.now();
        if (diffMs > 0) {
          setCountdownRemaining(Math.ceil(diffMs / 1000));
          setPhase("COUNTDOWN");
        } else {
          setPhase("EXAM");
        }
      } else {
        setPhase("WAITING");
      }
    } catch {
      setErrorMessage("Something went wrong on our side. Please try again.");
    }
  }

  // 2. Realtime Listener & 2-Second Polling for WAITING & COUNTDOWN
  useEffect(() => {
    if (phase !== "WAITING" && phase !== "COUNTDOWN") return;

    const supabase = createClient();

    const channel = supabase
      .channel(`quiz_${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quizzes",
          filter: `id=eq.${quizId}`,
        },
        (payload) => {
          const updated = payload.new as { start_at?: string; status?: string };
          if (updated.start_at) {
            setStartAt(updated.start_at);
            const diffMs = new Date(updated.start_at).getTime() - Date.now();
            if (diffMs > 0) {
              setCountdownRemaining(Math.ceil(diffMs / 1000));
              setPhase("COUNTDOWN");
            } else {
              setPhase("EXAM");
            }
          }
        }
      )
      .subscribe();

    let attemptChannel: ReturnType<typeof supabase.channel> | null = null;
    if (attemptId) {
      attemptChannel = supabase
        .channel(`attempt_${attemptId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "attempts",
            filter: `id=eq.${attemptId}`,
          },
          (payload) => {
            const updated = payload.new as { status?: string };
            if (updated.status === "blocked") {
              setPhase("BLOCKED");
            }
          }
        )
        .subscribe();
    }

    const pollInterval = setInterval(async () => {
      try {
        const { data: q } = await supabase
          .from("quizzes")
          .select("start_at, status")
          .eq("id", quizId)
          .single();

        if (q && q.start_at) {
          setStartAt(q.start_at);
          const diffMs = new Date(q.start_at).getTime() - Date.now();
          if (diffMs > 0) {
            setCountdownRemaining(Math.ceil(diffMs / 1000));
            setPhase("COUNTDOWN");
          } else {
            setPhase("EXAM");
          }
        }
      } catch {
        // Silent poll
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      if (attemptChannel) supabase.removeChannel(attemptChannel);
      clearInterval(pollInterval);
    };
  }, [phase, quizId, attemptId]);

  // 2b. Auto-Unblock Listener & 1.5s Poller for BLOCKED Phase
  // Listens for Proctor Re-authorization so exam opens automatically without page refresh
  useEffect(() => {
    if (phase !== "BLOCKED" || !attemptId) return;

    let isSubscribed = true;

    async function checkUnblock() {
      try {
        const res = await checkAttemptStatusAction({ attemptId, rollNumber });
        if (!isSubscribed) return;

        if (res.ok && res.data.status === "in_progress") {
          // Proctor has authorized re-exam!
          if (res.data.sessionToken) {
            setSessionToken(res.data.sessionToken);
          }
          hasTriggeredBlockRef.current = false;
          canTriggerBlurRef.current = false;
          setErrorMessage(null);
          setPhase("EXAM");
        }
      } catch {
        // Silent poll
      }
    }

    // Check immediately on entering BLOCKED phase
    checkUnblock();

    // Fast 1.5s poll to ensure reliable unlock across all network conditions
    const pollInterval = setInterval(checkUnblock, 1500);

    // Instant Supabase Realtime channel for live attempt status updates
    const supabase = createClient();
    const attemptChannel = supabase
      .channel(`attempt_unblock_${attemptId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "attempts",
          filter: `id=eq.${attemptId}`,
        },
        (payload) => {
          const updated = payload.new as { status?: string; session_token?: string };
          if (updated.status === "in_progress") {
            if (updated.session_token) {
              setSessionToken(updated.session_token);
            }
            hasTriggeredBlockRef.current = false;
            canTriggerBlurRef.current = false;
            setErrorMessage(null);
            setPhase("EXAM");
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      supabase.removeChannel(attemptChannel);
    };
  }, [phase, attemptId, rollNumber]);

  // 3. Countdown Timer
  useEffect(() => {
    if (phase !== "COUNTDOWN" || !startAt) return;

    const interval = setInterval(() => {
      const diffMs = new Date(startAt).getTime() - Date.now();
      if (diffMs <= 0) {
        clearInterval(interval);
        setCountdownRemaining(0);
        setPhase("EXAM");
      } else {
        setCountdownRemaining(Math.ceil(diffMs / 1000));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [phase, startAt]);

  // 4. Load Exam Questions on EXAM Phase entry
  useEffect(() => {
    if (phase !== "EXAM" || !attemptId || !sessionToken) return;

    let isMounted = true;

    async function loadExam() {
      try {
        const res = await getExamDataAction({ attemptId, sessionToken });
        if (!res.ok) {
          if (res.message.includes("blocked")) {
            setPhase("BLOCKED");
          } else {
            setErrorMessage(res.message);
          }
          return;
        }

        if (isMounted) {
          setQuestions(res.data.questions);
          setAnswers(res.data.savedAnswers || {});

          const examEndTime =
            new Date(res.data.startAt).getTime() + res.data.durationMinutes * 60 * 1000;
          const remainingSec = Math.max(0, Math.floor((examEndTime - Date.now()) / 1000));
          setExamRemainingSeconds(remainingSec);
        }
      } catch {
        setConnectionLost(true);
      }
    }

    loadExam();

    return () => {
      isMounted = false;
    };
  }, [phase, attemptId, sessionToken]);

  // 5. Anti-Cheat & Session Lock Listeners during EXAM
  useEffect(() => {
    if (phase !== "EXAM" || !attemptId || !sessionToken) return;

    const channelName = `quiz_session_channel_${quizId}_${rollNumber}`;
    try {
      const bc = new BroadcastChannel(channelName);
      broadcastChannelRef.current = bc;
      bc.postMessage({ type: "SESSION_PING", sessionToken });

      bc.onmessage = (event) => {
        if (event.data?.sessionToken && event.data.sessionToken !== sessionToken) {
          triggerBlock("Quiz was opened in another browser tab or window.");
        }
      };
    } catch {
      // BroadcastChannel unsupported fallback
    }

    // 1.5-second focus grace period when entering EXAM to prevent instant false-positive re-block
    canTriggerBlurRef.current = false;
    const graceTimer = setTimeout(() => {
      canTriggerBlurRef.current = true;
    }, 1500);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerBlock("Switched browser tab or minimized window during active exam.");
      }
    };

    const handleWindowBlur = () => {
      if (!canTriggerBlurRef.current) return;
      triggerBlock("Navigated away from examination window.");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        const res = await sendHeartbeatAction({ attemptId, sessionToken });
        if (!res.ok || res.data?.status === "blocked") {
          triggerBlock("Session terminated or marked blocked by administrator.");
        } else {
          setConnectionLost(false);
        }
      } catch {
        setConnectionLost(true);
      }
    }, 5000);

    return () => {
      clearTimeout(graceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [phase, attemptId, sessionToken, quizId, rollNumber, triggerBlock]);

  // 6. Exam Duration Timer & Auto-Submit
  useEffect(() => {
    if (phase !== "EXAM" || examRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setExamRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, examRemainingSeconds]);

  const handleAutoSubmit = useCallback(async () => {
    if (submitting || phase !== "EXAM") return;
    setSubmitting(true);
    try {
      const res = await submitQuizAction({ attemptId, sessionToken });
      if (res.ok) {
        setFinalScore(res.data.score);
        setTotalMarks(res.data.totalMarks);
        setPhase("SUBMITTED");
      }
    } catch {
      // Fallback
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, sessionToken, submitting, phase]);

  async function handleOptionSelect(questionId: string, option: string) {
    if (phase !== "EXAM") return;

    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setSavingStatus("saving");

    try {
      const res = await saveAnswerAction({
        attemptId,
        sessionToken,
        questionId,
        selectedOption: option,
      });

      if (!res.ok) {
        if (res.message.includes("blocked")) {
          setPhase("BLOCKED");
        } else {
          setConnectionLost(true);
        }
      } else {
        setSavingStatus("saved");
        setConnectionLost(false);
      }
    } catch {
      setSavingStatus("idle");
      setConnectionLost(true);
    }
  }

  async function handleManualSubmit() {
    setSubmitting(true);
    try {
      const res = await submitQuizAction({ attemptId, sessionToken });
      if (!res.ok) {
        setErrorMessage(res.message);
      } else {
        setFinalScore(res.data.score);
        setTotalMarks(res.data.totalMarks);
        setIsSubmitModalOpen(false);
        setPhase("SUBMITTED");
      }
    } catch {
      setErrorMessage("Submission failed. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // ==========================================
  // 1. REGISTRATION FORM (Soft UI)
  // ==========================================
  if (phase === "REGISTER") {
    return (
      <div className="max-w-md w-full mx-auto my-12 soft-card p-8 sm:p-10 relative">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-3 soft-button shadow-none">
            <CheckSquare className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Student Verification</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Enter your official registration credentials to access the examination
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-4 rounded-2xl bg-red-50/90 border border-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-red-700 leading-relaxed">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Roll Number (Unique ID)
            </label>
            <input
              type="text"
              required
              maxLength={50}
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. CS2024-001"
              className="w-full px-4 py-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-800 font-mono placeholder:text-slate-400"
            />
          </div>

          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="leading-snug">
              <strong>Anti-Cheat Policy:</strong> Refreshing, opening second tabs, or switching away from the exam window will trigger an instant security block.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white soft-button-primary"
          >
            Verify &amp; Proceed to Exam
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/quizzes" className="text-xs font-bold text-slate-500 hover:text-slate-800">
            &larr; Back to all quizzes
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. WAITING ROOM (Soft UI)
  // ==========================================
  if (phase === "WAITING") {
    return (
      <div className="max-w-lg w-full mx-auto my-16 soft-card p-8 sm:p-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto soft-pill animate-pulse">
          <Clock className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full soft-pill uppercase tracking-wider">
            Waiting Room
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-2">{quizTitle}</h2>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Welcome, <span className="font-bold text-slate-900">{studentName}</span> ({rollNumber})
          </p>
        </div>

        <div className="p-5 soft-card-subtle text-left text-xs text-slate-600 space-y-2">
          <p className="font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-blue-600" /> Awaiting Proctor Approval
          </p>
          <p className="leading-relaxed">
            The administrator has not initiated the exam countdown yet. Please remain on this screen. This page is connected via real-time synchronization and will update automatically as soon as the exam is approved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Real-time channel active. Listening for start signal...</span>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. COUNTDOWN (Soft UI)
  // ==========================================
  if (phase === "COUNTDOWN") {
    return (
      <div className="max-w-md w-full mx-auto my-16 soft-card p-8 sm:p-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto soft-pill">
          <Clock className="w-8 h-8 animate-spin" />
        </div>

        <div>
          <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-800 rounded-full soft-pill uppercase tracking-wider">
            Exam Approved
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-2">{quizTitle}</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Get ready. The exam will start automatically.</p>
        </div>

        {/* Neumorphic Inset Countdown Box */}
        <div className="py-8 soft-inset rounded-2xl">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">Quiz starts in</div>
          <div className="text-6xl font-mono font-black tracking-tight text-blue-600 mt-2">
            {formatTime(countdownRemaining)}
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          The countdown is locked to the official server clock. Refreshing or reloading this page will not reset or alter the timer.
        </p>
      </div>
    );
  }

  // ==========================================
  // 6. BLOCKED SCREEN (Soft UI)
  // ==========================================
  if (phase === "BLOCKED") {
    return (
      <div className="max-w-md w-full mx-auto my-16 soft-card p-8 sm:p-10 text-center space-y-6 border-red-200">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto soft-pill">
          <Lock className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900">You Have Been Blocked</h2>
          <p className="text-xs font-bold text-red-600 mt-1 uppercase tracking-wider">
            Security Policy Violation Detected
          </p>
        </div>

        <div className="p-4 bg-red-50/90 rounded-2xl border border-red-200 text-xs text-red-800 text-left space-y-2 leading-relaxed">
          <p className="font-bold">Reason for Lockout:</p>
          <p>
            An unauthorized session event occurred (e.g. window blur, tab switch, page refresh, or duplicate tab). Your examination attempt has been locked and answers cannot be saved.
          </p>
          <p className="pt-1 font-bold text-slate-900">
            Please contact your administrator or proctor to request a re-examination authorization.
          </p>
        </div>

        {/* Live Proctor Authorization Sync Banner */}
        <div
          className="p-3.5 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-amber-700 font-bold"
          style={{ background: "var(--bg)", boxShadow: "var(--press)" }}
        >
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <span>Listening for proctor authorization... As soon as admin unlocks, your exam opens automatically without refreshing.</span>
        </div>

        <div className="pt-1 text-xs text-slate-400 font-mono">Attempt Reference: {attemptId.slice(0, 8)}</div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={async () => {
              const res = await checkAttemptStatusAction({ attemptId, rollNumber });
              if (res.ok && res.data.status === "in_progress") {
                if (res.data.sessionToken) setSessionToken(res.data.sessionToken);
                hasTriggeredBlockRef.current = false;
                canTriggerBlurRef.current = false;
                setErrorMessage(null);
                setPhase("EXAM");
              }
            }}
            className="soft-button-primary text-xs font-bold cursor-pointer"
          >
            Check Status Now
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 soft-button"
          >
            Return to Portal
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // 5. SUBMITTED SCREEN (Soft UI)
  // ==========================================
  if (phase === "SUBMITTED") {
    return (
      <div className="max-w-md w-full mx-auto my-16 soft-card p-8 sm:p-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto soft-pill">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full soft-pill uppercase tracking-wider">
            Examination Complete
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-2">Thank you!</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Your responses have been securely recorded on the server.</p>
        </div>

        {/* Soft UI Score Card */}
        {showScore && finalScore !== null && (
          <div className="p-8 soft-inset rounded-2xl space-y-1">
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Your Calculated Score</span>
            <div className="text-5xl font-mono font-black text-emerald-600">
              {finalScore} {totalMarks > 0 ? `/ ${totalMarks}` : "pts"}
            </div>
            {totalMarks > 0 && (
              <span className="text-xs text-slate-500 font-bold block pt-1">
                ({Math.round((finalScore / totalMarks) * 100)}% accuracy)
              </span>
            )}
          </div>
        )}

        {!showScore && (
          <div className="p-4 soft-card-subtle text-xs text-slate-600 font-medium">
            Scores for this examination will be reviewed and published by your administrator.
          </div>
        )}

        <div className="pt-2">
          <Link
            href="/quizzes"
            className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-xs font-bold text-white soft-button-primary"
          >
            <span>Back to Quizzes</span>
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // 4. ACTIVE EXAM (Soft UI)
  // ==========================================
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col selection:bg-[var(--acc)] selection:text-white">
      {/* Anti-Cheat Banner */}
      <div className="bg-amber-600 text-white text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-xs">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          Exam Mode Active: Do not switch tabs, minimize, or reload this window. Any loss of window focus will immediately block your exam.
        </span>
      </div>

      {connectionLost && (
        <div className="bg-rose-600 text-white text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2 animate-bounce">
          <WifiOff className="w-4 h-4" />
          <span>Connection lost. Reconnecting to examination server...</span>
        </div>
      )}

      {/* Floating Soft Exam Header */}
      <header className="sticky top-0 z-20 px-4 sm:px-6 py-3.5 max-w-6xl w-full mx-auto">
        <div
          className="flex items-center justify-between px-5 py-3 rounded-full"
          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)" }}
        >
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-[var(--ink)] leading-tight truncate max-w-xs sm:max-w-md">
              {quizTitle}
            </h1>
            <p className="text-xs text-[var(--mute)] font-medium">
              Student: <span className="font-bold text-[var(--ink)]">{studentName}</span> ({rollNumber})
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] uppercase font-bold text-[var(--mute)]">Answer Status</span>
              <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1 justify-end">
                {savingStatus === "saving" && (
                  <span className="text-[var(--acc)] flex items-center gap-1 font-bold">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                  </span>
                )}
                {savingStatus === "saved" && (
                  <span className="text-[var(--acc2)] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Auto-saved
                  </span>
                )}
                {savingStatus === "idle" && <span>{Object.keys(answers).length} answered</span>}
              </div>
            </div>

            {/* Tactile Timer Pill */}
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-mono font-black text-sm ${
                examRemainingSeconds <= 120
                  ? "text-red-500 animate-pulse"
                  : "text-[var(--ink)]"
              }`}
              style={{ boxShadow: "var(--press)", background: "var(--bg)" }}
            >
              <Clock className="w-4 h-4 text-[var(--mute)]" />
              <span>{formatTime(examRemainingSeconds)}</span>
            </div>

            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="soft-button-primary !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Panel */}
        <div className="lg:col-span-3 space-y-6">
          {currentQuestion ? (
            <div className="soft-card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--lo)]">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                  style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                >
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-xs text-[var(--mute)] font-bold font-mono">
                  {currentQuestion.marks} {currentQuestion.marks === 1 ? "mark" : "marks"}
                </span>
              </div>

              <h2 className="text-base sm:text-xl font-bold text-[var(--ink)] leading-relaxed">
                {currentQuestion.question}
              </h2>

              {/* Options (Soft UI Tactile Buttons) */}
              <div className="space-y-3.5 pt-2">
                {[
                  { key: "a", text: currentQuestion.option_a },
                  { key: "b", text: currentQuestion.option_b },
                  { key: "c", text: currentQuestion.option_c },
                  { key: "d", text: currentQuestion.option_d },
                ].map((opt) => {
                  const isSelected = answers[currentQuestion.id] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleOptionSelect(currentQuestion.id, opt.key)}
                      className="w-full p-4 rounded-2xl text-left flex items-start gap-4 transition-all cursor-pointer"
                      style={{
                        background: "var(--bg)",
                        boxShadow: isSelected ? "var(--press)" : "var(--raise-s)",
                        border: 0,
                        color: isSelected ? "var(--acc)" : "var(--ink)",
                      }}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-black uppercase shrink-0 transition"
                        style={{
                          background: isSelected ? "var(--acc)" : "var(--bg)",
                          color: isSelected ? "var(--onacc)" : "var(--ink)",
                          boxShadow: isSelected ? "none" : "var(--raise-s)",
                        }}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm leading-snug mt-1 font-medium">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation Prev/Next */}
              <div className="pt-6 border-t border-[var(--lo)] flex items-center justify-between">
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="soft-button text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  &larr; Previous
                </button>

                <button
                  onClick={() =>
                    setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
                  }
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="soft-button-primary text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next Question &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="soft-card p-12 text-center text-[var(--mute)]">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
              <p className="text-sm font-bold">Preparing questions...</p>
            </div>
          )}
        </div>

        {/* Question Palette Sidebar */}
        <div>
          <div className="soft-card p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--mute)]">
              Question Palette
            </h3>

            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-2.5">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = currentQuestionIndex === idx;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className="h-10 rounded-xl font-mono text-xs font-black transition flex items-center justify-center cursor-pointer"
                    style={{
                      background: isAnswered ? "var(--acc2)" : "var(--bg)",
                      color: isAnswered ? "#fff" : isCurrent ? "var(--acc)" : "var(--ink)",
                      boxShadow: isCurrent ? "var(--press)" : "var(--raise-s)",
                      border: 0,
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[var(--lo)] space-y-2 text-[11px] text-[var(--mute)] font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full inline-block shadow-xs" style={{ background: "var(--acc2)" }} />
                <span>Answered ({Object.keys(answers).length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ boxShadow: "var(--press)", background: "var(--bg)" }} />
                <span>Unanswered ({questions.length - Object.keys(answers).length})</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Submit Confirmation Dialog */}
      {isSubmitModalOpen && (
        <div className="soft-modal-overlay p-4">
          <div className="soft-modal-content max-w-md w-full p-6 sm:p-8 space-y-4">
            <div className="ico">
              <HelpCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-black text-[var(--ink)]">Confirm Exam Submission</h3>
              <p className="text-xs text-[var(--mute)] mt-1 font-medium">
                You have answered <span className="font-bold text-[var(--ink)]">{Object.keys(answers).length}</span> of{" "}
                <span className="font-bold text-[var(--ink)]">{questions.length}</span> questions.
              </p>
            </div>

            <p className="text-xs text-amber-600 p-3.5 rounded-xl" style={{ boxShadow: "var(--press)", background: "var(--bg)" }}>
              Once submitted, you will not be able to modify your answers or re-enter the test.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={submitting}
                className="soft-button cursor-pointer"
              >
                Continue Exam
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={submitting}
                className="soft-button-primary disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Yes, Submit Now"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
