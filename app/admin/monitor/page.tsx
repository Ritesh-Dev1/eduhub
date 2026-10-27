"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Users,
  CheckCircle2,
  Clock,
  Lock,
  Download,
  AlertCircle,
  Loader2,
  RefreshCw,
  Unlock,
  Award,
  Layers,
} from "lucide-react";
import { getQuizzesAction, type QuizListItem } from "@/app/actions/quizzes";
import {
  getLiveMonitorDataAction,
  allowReExamAction,
  exportQuizResultsCsvAction,
  type StudentAttemptMonitorItem,
  type MonitorSummary,
} from "@/app/actions/monitor";

export default function AdminMonitorPage() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);

  const [monitorLoading, setMonitorLoading] = useState(false);
  const [attempts, setAttempts] = useState<StudentAttemptMonitorItem[]>([]);
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [quizInfo, setQuizInfo] = useState<{
    title: string;
    status: string;
    durationMinutes: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [reExamAttempt, setReExamAttempt] = useState<StudentAttemptMonitorItem | null>(null);
  const [reExamMode, setReExamMode] = useState<"resume" | "restart">("resume");
  const [reExamReason, setReExamReason] = useState("");
  const [reExamSubmitting, setReExamSubmitting] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"monitor" | "results">("monitor");

  useEffect(() => {
    async function loadQuizzes() {
      setLoadingQuizzes(true);
      const res = await getQuizzesAction();
      if (res.ok) {
        setQuizzes(res.data.quizzes);
        if (res.data.quizzes.length > 0) {
          const active = res.data.quizzes.find((q) => q.status === "live" || q.status === "open");
          setSelectedQuizId(active ? active.id : res.data.quizzes[0].id);
        }
      }
      setLoadingQuizzes(false);
    }
    loadQuizzes();
  }, []);

  const fetchMonitorData = useCallback(
    async (quizId: string, showSpinner = false) => {
      if (!quizId) return;
      if (showSpinner) setMonitorLoading(true);

      const res = await getLiveMonitorDataAction(quizId);
      if (!res.ok) {
        setError(res.message);
      } else {
        setAttempts(res.data.attempts);
        setSummary(res.data.summary);
        setQuizInfo({
          title: res.data.quizTitle,
          status: res.data.quizStatus,
          durationMinutes: res.data.durationMinutes,
        });
      }
      if (showSpinner) setMonitorLoading(false);
    },
    []
  );

  useEffect(() => {
    if (selectedQuizId) {
      fetchMonitorData(selectedQuizId, true);
    }
  }, [selectedQuizId, fetchMonitorData]);

  useEffect(() => {
    if (!selectedQuizId) return;
    const interval = setInterval(() => {
      fetchMonitorData(selectedQuizId, false);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedQuizId, fetchMonitorData]);

  async function handleAllowReExam(e: React.FormEvent) {
    e.preventDefault();
    if (!reExamAttempt) return;

    setReExamSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await allowReExamAction({
      attemptId: reExamAttempt.id,
      mode: reExamMode,
      reason: reExamReason.trim() || undefined,
    });

    if (!res.ok) {
      setError(res.message);
    } else {
      setSuccess(`Re-exam authorized for student "${reExamAttempt.name}" (${reExamMode.toUpperCase()} mode).`);
      setReExamAttempt(null);
      setReExamReason("");
      fetchMonitorData(selectedQuizId, false);
    }
    setReExamSubmitting(false);
  }

  async function handleExportCsv() {
    if (!selectedQuizId) return;
    setExporting(true);
    setError(null);

    const res = await exportQuizResultsCsvAction(selectedQuizId);
    if (!res.ok) {
      setError(res.message);
    } else {
      const blob = new Blob([res.data.csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", res.data.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  function formatTime(seconds?: number) {
    if (seconds === undefined || seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function getStatusPill(status: StudentAttemptMonitorItem["status"]) {
    switch (status) {
      case "in_progress":
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
            style={{ boxShadow: "var(--press)", color: "var(--acc2)" }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--acc2)" }} /> In Progress
          </span>
        );
      case "blocked":
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
            style={{ boxShadow: "var(--press)", color: "#e05260" }}
          >
            <Lock className="w-3.5 h-3.5" /> Blocked
          </span>
        );
      case "submitted":
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
          >
            Submitted
          </span>
        );
      case "waiting":
      case "countdown":
      default:
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--mute)" }}
          >
            Waiting Room
          </span>
        );
    }
  }

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">Live Monitor &amp; Results</h1>
          <p className="text-xs sm:text-sm text-[var(--mute)] font-medium mt-1">
            Real-time proctoring, session tracking, security lockouts, and grading reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedQuizId}
            onChange={(e) => setSelectedQuizId(e.target.value)}
            disabled={loadingQuizzes}
            className="soft-input px-4 py-2.5 text-xs sm:text-sm font-bold"
          >
            {quizzes.map((q) => (
              <option key={q.id} value={q.id} className="bg-[var(--bg)] text-[var(--ink)]">
                {q.title} ({q.status.toUpperCase()})
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchMonitorData(selectedQuizId, true)}
            disabled={monitorLoading}
            className="w-10 h-10 rounded-full flex items-center justify-center soft-button cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${monitorLoading ? "animate-spin text-[var(--acc)]" : ""}`} />
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || !selectedQuizId}
            className="soft-button-success text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="soft-card p-4 flex items-start gap-3" style={{ border: "1px solid #e05260" }}>
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-red-500">{error}</p>
        </div>
      )}
      {success && (
        <div className="soft-card p-4 flex items-start gap-3" style={{ border: "1px solid var(--acc2)" }}>
          <CheckCircle2 className="w-5 h-5 text-[var(--acc2)] shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-[var(--acc2)]">{success}</p>
        </div>
      )}

      {/* Summary Stat Cards (Soft UI) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="soft-card p-5">
            <div className="flex items-center gap-2 text-[var(--mute)] text-[11px] font-bold uppercase">
              <Users className="w-4 h-4 text-[var(--acc)]" /> Registered
            </div>
            <div className="text-2xl font-black text-[var(--ink)] mt-2">{summary.registered}</div>
            <div className="text-[10px] text-[var(--mute)] mt-0.5 font-medium">Eligible students</div>
          </div>

          <div className="soft-card p-5">
            <div className="flex items-center gap-2 text-[var(--acc)] text-[11px] font-bold uppercase">
              <Activity className="w-4 h-4" /> Attempted
            </div>
            <div className="text-2xl font-black text-[var(--acc)] mt-2">{summary.attempted}</div>
            <div className="text-[10px] text-[var(--mute)] mt-0.5 font-medium">Joined session</div>
          </div>

          <div className="soft-card p-5">
            <div className="flex items-center gap-2 text-[var(--acc2)] text-[11px] font-bold uppercase">
              <Clock className="w-4 h-4" /> In Progress
            </div>
            <div className="text-2xl font-black text-[var(--acc2)] mt-2">{summary.inProgress}</div>
            <div className="text-[10px] text-[var(--mute)] mt-0.5 font-medium">Writing exam</div>
          </div>

          <div className="soft-card p-5">
            <div className="flex items-center gap-2 text-[var(--acc)] text-[11px] font-bold uppercase">
              <CheckCircle2 className="w-4 h-4" /> Submitted
            </div>
            <div className="text-2xl font-black text-[var(--acc)] mt-2">{summary.submitted}</div>
            <div className="text-[10px] text-[var(--mute)] mt-0.5 font-medium">Graded attempts</div>
          </div>

          <div className="soft-card p-5">
            <div className="flex items-center gap-2 text-red-500 text-[11px] font-bold uppercase">
              <Lock className="w-4 h-4" /> Blocked
            </div>
            <div className="text-2xl font-black text-red-500 mt-2">{summary.blocked}</div>
            <div className="text-[10px] text-[var(--mute)] mt-0.5 font-medium">Security flags</div>
          </div>

          <div className="soft-card p-5">
            <div className="flex items-center gap-2 text-amber-500 text-[11px] font-bold uppercase">
              <Award className="w-4 h-4" /> Avg Score
            </div>
            <div className="text-2xl font-black text-amber-500 mt-2">{summary.averageScore}</div>
            <div className="text-[10px] text-[var(--mute)] mt-0.5 font-medium">Out of {summary.totalMarks} pts</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-full w-fit" style={{ boxShadow: "var(--press)", background: "var(--bg)" }}>
        <button
          onClick={() => setActiveTab("monitor")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            activeTab === "monitor"
              ? "text-[var(--ink)] shadow-[var(--press)] font-extrabold"
              : "text-[var(--mute)] hover:text-[var(--ink)]"
          }`}
          style={{ border: 0, background: "transparent" }}
        >
          <Activity className="w-4 h-4 text-[var(--acc)]" />
          <span>Live Proctoring</span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
          >
            {attempts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("results")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            activeTab === "results"
              ? "text-[var(--ink)] shadow-[var(--press)] font-extrabold"
              : "text-[var(--mute)] hover:text-[var(--ink)]"
          }`}
          style={{ border: 0, background: "transparent" }}
        >
          <Layers className="w-4 h-4 text-[var(--acc2)]" />
          <span>Final Results</span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--mute)" }}
          >
            {attempts.filter((a) => a.status === "submitted").length}
          </span>
        </button>
      </div>

      {/* TAB 1: LIVE PROCTORING MONITOR (Soft UI) */}
      {activeTab === "monitor" && (
        <div className="soft-card overflow-hidden">
          {monitorLoading && attempts.length === 0 ? (
            <div className="p-16 text-center text-[var(--mute)]">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
              <p className="text-xs font-bold">Connecting to live examination monitor...</p>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-16 text-center text-[var(--mute)]">
              <Users className="w-12 h-12 mx-auto opacity-30 mb-2" />
              <p className="text-base font-bold text-[var(--ink)]">No student attempts recorded</p>
              <p className="text-xs text-[var(--mute)] mt-1">
                Students will appear here as soon as they join this quiz.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--lo)] text-xs font-bold text-[var(--mute)] uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Roll Number</th>
                      <th className="px-6 py-4">Live Status</th>
                      <th className="px-6 py-4">Time Left</th>
                      <th className="px-6 py-4">Last Heartbeat</th>
                      <th className="px-6 py-4 text-right">Proctor Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--lo)]">
                    {attempts.map((att) => (
                      <tr key={att.id} className="hover:bg-[var(--lo)]/10 transition">
                        <td className="px-6 py-4 font-bold text-[var(--ink)]">{att.name}</td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-[var(--ink)]">{att.roll_number}</td>
                        <td className="px-6 py-4">{getStatusPill(att.status)}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {att.status === "in_progress" ? (
                            <span className="font-bold text-[var(--ink)]">
                              {formatTime(att.timeLeftSeconds)}
                            </span>
                          ) : (
                            <span className="text-[var(--mute)]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-[var(--mute)] font-medium">
                          {new Date(att.last_heartbeat).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {att.status === "blocked" ? (
                            <button
                              onClick={() => {
                                setReExamAttempt(att);
                                setReExamMode("resume");
                                setReExamReason("");
                              }}
                              className="soft-button-danger text-xs !py-1 !px-3 font-bold cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              Allow Re-exam
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--mute)] font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden divide-y divide-[var(--lo)]">
                {attempts.map((att) => (
                  <div key={att.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm text-[var(--ink)]">{att.name}</p>
                        <p className="font-mono text-xs text-[var(--mute)]">{att.roll_number}</p>
                      </div>
                      {getStatusPill(att.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--mute)] pt-1">
                      <span>Time left: <strong className="text-[var(--ink)] font-mono">{att.status === "in_progress" ? formatTime(att.timeLeftSeconds) : "—"}</strong></span>
                      {att.status === "blocked" && (
                        <button
                          onClick={() => {
                            setReExamAttempt(att);
                            setReExamMode("resume");
                            setReExamReason("");
                          }}
                          className="soft-button-danger text-xs !py-1 !px-2.5 font-bold"
                        >
                          <Unlock className="w-3 h-3" /> Re-exam
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: FINAL RESULTS */}
      {activeTab === "results" && (
        <div className="soft-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600 font-bold">
            <span>
              Submissions for: <strong className="text-slate-900">{quizInfo?.title}</strong>
            </span>
            <span>Total Marks: {summary?.totalMarks ?? 0}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Roll Number</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Percentage</th>
                  <th className="px-6 py-4">Submitted At</th>
                  <th className="px-6 py-4">Security Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts
                  .filter((a) => a.status === "submitted")
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((res, index) => {
                    const total = summary?.totalMarks || 1;
                    const pct = Math.round(((res.score || 0) / total) * 100);

                    return (
                      <tr key={res.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-black font-mono text-xs text-slate-500">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{res.name}</td>
                        <td className="px-6 py-4 font-mono text-xs font-bold">{res.roll_number}</td>
                        <td className="px-6 py-4 font-mono font-black text-emerald-700">
                          {res.score ?? 0} / {total}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-800">
                          {pct}%
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                          {res.submitted_at ? new Date(res.submitted_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {res.times_blocked > 0 ? (
                            <span className="font-bold text-red-600">
                              {res.times_blocked} {res.times_blocked === 1 ? "flag" : "flags"}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allow Re-exam Modal (Soft UI) */}
      {reExamAttempt && (
        <div className="soft-modal-overlay p-4">
          <div className="soft-modal-content max-w-md w-full p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center soft-pill">
              <Unlock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-black text-[var(--ink)]">Authorize Student Re-exam</h3>
              <p className="text-xs text-[var(--mute)] mt-1 font-medium">
                Student: <strong className="text-[var(--ink)]">{reExamAttempt.name}</strong> (Roll:{" "}
                {reExamAttempt.roll_number})
              </p>
            </div>

            <form onSubmit={handleAllowReExam} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Authorization Mode
                </label>
                <div className="space-y-2.5">
                  <label className="flex items-start gap-3 p-3.5 rounded-2xl soft-card-subtle cursor-pointer">
                    <input
                      type="radio"
                      name="reExamMode"
                      value="resume"
                      checked={reExamMode === "resume"}
                      onChange={() => setReExamMode("resume")}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Resume Current Attempt</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Preserves previously saved answers and remaining exam duration.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3.5 rounded-2xl soft-card-subtle cursor-pointer">
                    <input
                      type="radio"
                      name="reExamMode"
                      value="restart"
                      checked={reExamMode === "restart"}
                      onChange={() => setReExamMode("restart")}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Restart Fresh Attempt</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Clears all previous answers and restarts the timer.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Proctor Justification (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={reExamReason}
                  onChange={(e) => setReExamReason(e.target.value)}
                  placeholder="e.g. Accidental window click or approved power issue"
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-medium soft-inset text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setReExamAttempt(null)}
                  disabled={reExamSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 soft-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reExamSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white soft-button-danger disabled:opacity-50"
                >
                  {reExamSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Authorizing...
                    </>
                  ) : (
                    "Authorize & Unlock"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
