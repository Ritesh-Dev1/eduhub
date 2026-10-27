"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import {
  CheckSquare,
  Clock,
  HelpCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { getQuizzesAction, type QuizListItem } from "@/app/actions/quizzes";

export default function PublicQuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadQuizzes() {
    setLoading(true);
    setError(null);
    const res = await getQuizzesAction();
    if (!res.ok) {
      setError(res.message);
    } else {
      setQuizzes(res.data.quizzes);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadQuizzes();
  }, []);

  function renderStatusBadge(status: QuizListItem["status"]) {
    switch (status) {
      case "open":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
          >
            Registration Open
          </span>
        );
      case "live":
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--acc2)" }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--acc2)" }} />
            Live Exam
          </span>
        );
      case "closed":
        return (
          <span
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "#e05260" }}
          >
            Exam Ended
          </span>
        );
      case "draft":
      default:
        return (
          <span
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--mute)" }}
          >
            Upcoming
          </span>
        );
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col selection:bg-[var(--acc)] selection:text-white">
      <PublicHeader />

      <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* Soft UI Banner */}
        <div className="card p-6 sm:p-10 relative overflow-hidden">
          <div className="max-w-2xl space-y-3 relative z-10">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
            >
              <CheckSquare className="w-3.5 h-3.5" /> Assessment Suite
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
              Proctored Online Examinations
            </h1>
            <p className="text-sm sm:text-base text-[var(--mute)] font-medium">
              Participate in scheduled institutional evaluations. Ensure you have your verified name and roll number ready.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="card p-4 flex items-start gap-3"
            style={{ border: "1px solid #e05260" }}
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-500 font-semibold">{error}</p>
              <button
                onClick={loadQuizzes}
                className="text-xs font-bold text-red-600 underline mt-1 cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-24 text-center text-[var(--mute)]">
            <Loader2 className="w-9 h-9 animate-spin mx-auto text-[var(--acc)] mb-3" />
            <p className="text-sm font-bold text-[var(--ink)]">Loading examination schedules...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && quizzes.length === 0 && (
          <div className="py-20 card text-center p-8">
            <HelpCircle className="w-12 h-12 text-[var(--mute)] mx-auto mb-3 opacity-30" />
            <h3 className="text-base font-bold text-[var(--ink)]">No quizzes scheduled</h3>
            <p className="text-xs text-[var(--mute)] max-w-sm mx-auto mt-1">
              There are currently no active or upcoming quizzes configured. Please check back later.
            </p>
          </div>
        )}

        {/* Quizzes Grid (Soft UI Cards) */}
        {!loading && quizzes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {quizzes.map((quiz) => {
              const canEnter = quiz.status === "open" || quiz.status === "live";

              return (
                <div
                  key={quiz.id}
                  className="card justify-between space-y-6 hover:-translate-y-1 transition-all"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      {renderStatusBadge(quiz.status)}
                      <div
                        className="flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-full"
                        style={{ boxShadow: "var(--press)", color: "var(--mute)" }}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {quiz.duration_minutes} mins
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-extrabold text-[var(--ink)] leading-snug line-clamp-2">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-[var(--mute)] mt-2 font-medium">
                        Total questions: <span className="font-bold text-[var(--ink)]">{quiz.question_count}</span> &bull;{" "}
                        Total marks: <span className="font-bold text-[var(--ink)]">{quiz.total_marks}</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--lo)]">
                    {canEnter ? (
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-bold text-white transition-all cursor-pointer ${
                          quiz.status === "live" ? "soft-button-success" : "soft-button-primary"
                        }`}
                        style={{ textDecoration: "none" }}
                      >
                        <span>{quiz.status === "live" ? "Enter Live Exam" : "Join Waiting Room"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <div
                        className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full text-xs font-bold text-[var(--mute)] cursor-not-allowed"
                        style={{ boxShadow: "var(--press)", background: "var(--bg)" }}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{quiz.status === "closed" ? "Exam Completed" : "Not Open Yet"}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
