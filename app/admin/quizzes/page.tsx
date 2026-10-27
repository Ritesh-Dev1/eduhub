"use client";

import { useEffect, useState, useRef } from "react";
import {
  HelpCircle,
  Plus,
  Trash2,
  Edit3,
  Play,
  CheckCircle,
  Clock,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  SquareCheck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  getQuizzesAction,
  getQuizAdminDetailsAction,
  createQuizManualAction,
  updateQuizAction,
  deleteQuizAction,
  previewQuizQuestionsCsvAction,
  createQuizFromCsvAction,
  updateQuizStatusAction,
  type QuizListItem,
  type QuizStatus,
  type QuizCsvRowPreview,
} from "@/app/actions/quizzes";
import type { QuestionInput } from "@/lib/validations/quiz";

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Manual Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSubmitting, setEditorSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [countdownSeconds, setCountdownSeconds] = useState(180);
  const [showScore, setShowScore] = useState(true);
  const [questions, setQuestions] = useState<QuestionInput[]>([
    {
      question: "",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "a",
      marks: 1,
      position: 0,
    },
  ]);

  // CSV State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvTitle, setCsvTitle] = useState("");
  const [csvDuration, setCsvDuration] = useState(30);
  const [csvCountdown, setCsvCountdown] = useState(180);
  const [csvShowScore, setCsvShowScore] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewing, setCsvPreviewing] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<{
    previewRows: QuizCsvRowPreview[];
    totalRows: number;
    validCount: number;
    invalidCount: number;
  } | null>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  // Delete State
  const [deletingQuiz, setDeletingQuiz] = useState<QuizListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  function handleOpenCreateManual() {
    setEditingQuizId(null);
    setTitle("");
    setDurationMinutes(30);
    setCountdownSeconds(180);
    setShowScore(true);
    setQuestions([
      {
        question: "",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_answer: "a",
        marks: 1,
        position: 0,
      },
    ]);
    setIsEditorOpen(true);
  }

  async function handleOpenEdit(quiz: QuizListItem) {
    setEditingQuizId(quiz.id);
    setIsEditorOpen(true);
    setEditorLoading(true);

    const res = await getQuizAdminDetailsAction(quiz.id);
    if (!res.ok) {
      setError(res.message);
      setIsEditorOpen(false);
    } else {
      const q = res.data.quiz;
      setTitle(q.title);
      setDurationMinutes(q.duration_minutes);
      setCountdownSeconds(q.countdown_seconds);
      setShowScore(q.show_score);
      setQuestions(
        q.questions.length > 0
          ? q.questions.map((item, idx) => ({
              question: item.question,
              option_a: item.option_a,
              option_b: item.option_b,
              option_c: item.option_c,
              option_d: item.option_d,
              correct_answer: item.correct_answer,
              marks: item.marks,
              position: idx,
            }))
          : [
              {
                question: "",
                option_a: "",
                option_b: "",
                option_c: "",
                option_d: "",
                correct_answer: "a",
                marks: 1,
                position: 0,
              },
            ]
      );
    }
    setEditorLoading(false);
  }

  function handleAddQuestion() {
    setQuestions([
      ...questions,
      {
        question: "",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_answer: "a",
        marks: 1,
        position: questions.length,
      },
    ]);
  }

  function handleRemoveQuestion(idx: number) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  function handleMoveQuestion(idx: number, direction: "up" | "down") {
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === questions.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated);
  }

  function updateQuestionField(idx: number, field: keyof QuestionInput, val: unknown) {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: val };
    setQuestions(updated);
  }

  async function handleSaveQuiz(e: React.FormEvent) {
    e.preventDefault();
    setEditorSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      title: title.trim(),
      duration_minutes: Number(durationMinutes),
      countdown_seconds: Number(countdownSeconds),
      show_score: Boolean(showScore),
      questions: questions.map((q, idx) => ({
        ...q,
        marks: Number(q.marks),
        position: idx,
      })),
    };

    try {
      if (editingQuizId) {
        const res = await updateQuizAction(editingQuizId, payload);
        if (!res.ok) {
          setError(res.message);
        } else {
          setSuccess("Quiz updated successfully.");
          setIsEditorOpen(false);
          loadQuizzes();
        }
      } else {
        const res = await createQuizManualAction(payload);
        if (!res.ok) {
          setError(res.message);
        } else {
          setSuccess("Quiz created successfully.");
          setIsEditorOpen(false);
          loadQuizzes();
        }
      }
    } catch {
      setError("An unexpected error occurred while saving the quiz.");
    } finally {
      setEditorSubmitting(false);
    }
  }

  async function handleStatusChange(quizId: string, newStatus: QuizStatus) {
    setUpdatingStatusId(quizId);
    setError(null);
    setSuccess(null);

    const res = await updateQuizStatusAction(quizId, newStatus);
    if (!res.ok) {
      setError(res.message);
    } else {
      if (newStatus === "live") {
        setSuccess("Quiz approved! 3-minute synchronized countdown initiated.");
      } else {
        setSuccess(`Quiz status transitioned to ${newStatus.toUpperCase()}.`);
      }
      loadQuizzes();
    }
    setUpdatingStatusId(null);
  }

  async function handleDeleteQuiz() {
    if (!deletingQuiz) return;
    setIsDeleting(true);
    const res = await deleteQuizAction(deletingQuiz.id);
    if (!res.ok) {
      setError(res.message);
    } else {
      setSuccess("Quiz and associated records deleted.");
      setDeletingQuiz(null);
      loadQuizzes();
    }
    setIsDeleting(false);
  }

  async function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      if (csvFileRef.current) csvFileRef.current.value = "";
      return;
    }

    setCsvFile(file);
    setCsvPreviewing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const res = await previewQuizQuestionsCsvAction(content);
      if (!res.ok) {
        setError(res.message);
        setCsvPreviewData(null);
      } else {
        setCsvPreviewData(res.data);
      }
      setCsvPreviewing(false);
    };
    reader.onerror = () => {
      setError("Unable to read CSV file.");
      setCsvPreviewing(false);
    };
    reader.readAsText(file);
  }

  async function handleImportQuizCsv() {
    if (!csvPreviewData) return;
    if (!csvTitle.trim()) {
      setError("Please specify a quiz title.");
      return;
    }

    const validQuestions = csvPreviewData.previewRows
      .filter((r) => r.isValid)
      .map((r) => ({
        question: r.question,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        correct_answer: r.correct_answer as "a" | "b" | "c" | "d",
        marks: r.marks,
      }));

    if (validQuestions.length === 0) {
      setError("Cannot create quiz with 0 valid questions.");
      return;
    }

    setCsvImporting(true);
    setError(null);

    const res = await createQuizFromCsvAction({
      title: csvTitle.trim(),
      duration_minutes: Number(csvDuration),
      countdown_seconds: Number(csvCountdown),
      show_score: Boolean(csvShowScore),
      questions: validQuestions,
    });

    if (!res.ok) {
      setError(res.message);
    } else {
      setSuccess(`Quiz "${csvTitle.trim()}" created successfully with ${validQuestions.length} questions!`);
      setIsCsvModalOpen(false);
      setCsvFile(null);
      setCsvPreviewData(null);
      loadQuizzes();
    }
    setCsvImporting(false);
  }

  function getStatusBadge(status: QuizStatus) {
    switch (status) {
      case "draft":
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--mute)" }}
          >
            Draft
          </span>
        );
      case "open":
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
          >
            Registration Open
          </span>
        );
      case "live":
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
            style={{ boxShadow: "var(--press)", color: "var(--acc2)" }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--acc2)" }} /> Live Exam
          </span>
        );
      case "closed":
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ boxShadow: "var(--press)", color: "#e05260" }}
          >
            Closed
          </span>
        );
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">Quiz Administration</h1>
          <p className="text-xs sm:text-sm text-[var(--mute)] font-medium mt-1">
            Configure examination schedules, edit questions, and control live status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/templates/quiz_template.csv"
            download="quiz_template.csv"
            className="soft-button text-xs font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Template
          </a>
          <button
            onClick={() => {
              setCsvTitle("");
              setCsvDuration(30);
              setCsvCountdown(180);
              setCsvShowScore(true);
              setCsvFile(null);
              setCsvPreviewData(null);
              setIsCsvModalOpen(true);
            }}
            className="soft-button-success text-xs font-bold cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload CSV
          </button>
          <button
            onClick={handleOpenCreateManual}
            className="soft-button-primary text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Quiz
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

      {/* Quizzes List Card (Soft UI) */}
      <div className="soft-card overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[var(--lo)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-[var(--acc)]" />
            <h2 className="text-base font-bold text-[var(--ink)]">Configured Quizzes</h2>
            <span
              className="text-xs px-3 py-1 rounded-full font-bold"
              style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
            >
              {quizzes.length} Total
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-16 text-center text-[var(--mute)]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
            <p className="text-xs font-bold">Loading quizzes from database...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && quizzes.length === 0 && (
          <div className="p-16 text-center text-[var(--mute)]">
            <HelpCircle className="w-12 h-12 mx-auto opacity-30 mb-3" />
            <p className="text-base font-bold text-[var(--ink)]">No quizzes configured yet</p>
            <p className="text-xs text-[var(--mute)] mt-1">
              Create an exam manually or upload questions via CSV above.
            </p>
          </div>
        )}

        {/* Desktop & Tablet Quizzes Table */}
        {!loading && quizzes.length > 0 && (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--lo)] text-xs font-bold text-[var(--mute)] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Quiz Title</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Questions &amp; Marks</th>
                    <th className="px-6 py-4">Workflow Actions</th>
                    <th className="px-6 py-4 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lo)]">
                  {quizzes.map((quiz) => (
                    <tr key={quiz.id} className="hover:bg-[var(--lo)]/10 transition">
                      <td className="px-6 py-4 font-bold text-[var(--ink)]">
                        <div>{quiz.title}</div>
                        <div className="text-xs text-[var(--mute)] font-normal mt-0.5">
                          Countdown: {quiz.countdown_seconds}s | Show Score: {quiz.show_score ? "Yes" : "No"}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(quiz.status)}</td>
                      <td className="px-6 py-4 text-xs font-bold text-[var(--mute)]">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {quiz.duration_minutes} mins
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--mute)]">
                        <span className="font-bold text-[var(--ink)]">{quiz.question_count}</span> questions (
                        <span className="font-bold text-[var(--ink)]">{quiz.total_marks}</span> marks)
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {quiz.status === "draft" && (
                            <button
                              onClick={() => handleStatusChange(quiz.id, "open")}
                              disabled={updatingStatusId === quiz.id}
                              className="soft-button text-xs !py-1 !px-3 font-bold text-[var(--acc)] cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              Open
                            </button>
                          )}
                          {quiz.status === "open" && (
                            <button
                              onClick={() => handleStatusChange(quiz.id, "live")}
                              disabled={updatingStatusId === quiz.id}
                              className="soft-button-success text-xs !py-1 !px-3.5 font-bold cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve &amp; Start
                            </button>
                          )}
                          {quiz.status === "live" && (
                            <button
                              onClick={() => handleStatusChange(quiz.id, "closed")}
                              disabled={updatingStatusId === quiz.id}
                              className="soft-button-danger text-xs !py-1 !px-3 font-bold cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" />
                              Close Quiz
                            </button>
                          )}
                          {quiz.status === "closed" && (
                            <button
                              onClick={() => handleStatusChange(quiz.id, "draft")}
                              disabled={updatingStatusId === quiz.id}
                              className="soft-button text-xs !py-1 !px-3 font-bold text-[var(--mute)] cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(quiz)}
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--ink)] hover:text-[var(--acc)] active:shadow-[var(--press)] cursor-pointer"
                          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                          title="Edit Quiz"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingQuiz(quiz)}
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-red-500 hover:text-red-700 active:shadow-[var(--press)] cursor-pointer"
                          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                          title="Delete Quiz"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Quizzes (Responsive on small screens) */}
            <div className="sm:hidden divide-y divide-[var(--lo)]">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-sm text-[var(--ink)]">{quiz.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(quiz.status)}
                        <span className="text-[11px] text-[var(--mute)] font-mono">{quiz.duration_minutes}m</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(quiz)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink)]"
                        style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingQuiz(quiz)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-red-500"
                        style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-[var(--mute)]">
                      {quiz.question_count} Qs ({quiz.total_marks} Marks)
                    </span>
                    <div>
                      {quiz.status === "draft" && (
                        <button
                          onClick={() => handleStatusChange(quiz.id, "open")}
                          disabled={updatingStatusId === quiz.id}
                          className="soft-button text-xs !py-1 !px-3 font-bold text-[var(--acc)]"
                        >
                          <Play className="w-3 h-3" /> Open
                        </button>
                      )}
                      {quiz.status === "open" && (
                        <button
                          onClick={() => handleStatusChange(quiz.id, "live")}
                          disabled={updatingStatusId === quiz.id}
                          className="soft-button-success text-xs !py-1 !px-3 font-bold"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Start
                        </button>
                      )}
                      {quiz.status === "live" && (
                        <button
                          onClick={() => handleStatusChange(quiz.id, "closed")}
                          disabled={updatingStatusId === quiz.id}
                          className="soft-button-danger text-xs !py-1 !px-3 font-bold"
                        >
                          <XCircle className="w-3 h-3" /> Close
                        </button>
                      )}
                      {quiz.status === "closed" && (
                        <button
                          onClick={() => handleStatusChange(quiz.id, "draft")}
                          disabled={updatingStatusId === quiz.id}
                          className="soft-button text-xs !py-1 !px-3 font-bold text-[var(--mute)]"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Manual Quiz Editor / Creator Modal (Soft UI) */}
      {isEditorOpen && (
        <div className="soft-modal-overlay" onClick={() => setIsEditorOpen(false)}>
          <div className="soft-modal-content max-w-4xl w-full p-6 sm:p-8 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--lo)]">
              <h3 className="text-xl font-black text-[var(--ink)]">
                {editingQuizId ? "Edit Quiz & Questions" : "Create New Quiz"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center soft-button cursor-pointer text-[var(--mute)]"
              >
                ✕
              </button>
            </div>

            {editorLoading ? (
              <div className="p-16 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                <p className="text-xs font-bold">Loading quiz details...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveQuiz} className="flex-1 overflow-y-auto py-2 space-y-6 pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 soft-card-subtle">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Quiz Title
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={150}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Mid-term Assessment: Computer Networks"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Duration (Mins)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={300}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Countdown (Sec)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={600}
                      value={countdownSeconds}
                      onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-800"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      id="show-score-checkbox"
                      type="checkbox"
                      checked={showScore}
                      onChange={(e) => setShowScore(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="show-score-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Show score immediately to student after submission
                    </label>
                  </div>
                </div>

                {/* Questions Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Questions List ({questions.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 soft-button"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Question
                    </button>
                  </div>

                  <div className="space-y-4">
                    {questions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl soft-card-subtle space-y-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black px-3 py-1 rounded-full bg-blue-100 text-blue-800 soft-pill">
                            Question #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, "up")}
                              disabled={idx === 0}
                              className="p-1.5 soft-button rounded-lg text-slate-500 disabled:opacity-30"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, "down")}
                              disabled={idx === questions.length - 1}
                              className="p-1.5 soft-button rounded-lg text-slate-500 disabled:opacity-30"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(idx)}
                              disabled={questions.length <= 1}
                              className="p-1.5 soft-button rounded-lg text-red-500 disabled:opacity-30"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            required
                            value={q.question}
                            onChange={(e) => updateQuestionField(idx, "question", e.target.value)}
                            placeholder="Enter the question text here..."
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-900"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-slate-600 mb-1 font-bold">Option A</label>
                            <input
                              type="text"
                              required
                              value={q.option_a}
                              onChange={(e) => updateQuestionField(idx, "option_a", e.target.value)}
                              placeholder="Option A"
                              className="w-full px-3 py-2 rounded-xl soft-inset text-xs font-medium outline-none text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 font-bold">Option B</label>
                            <input
                              type="text"
                              required
                              value={q.option_b}
                              onChange={(e) => updateQuestionField(idx, "option_b", e.target.value)}
                              placeholder="Option B"
                              className="w-full px-3 py-2 rounded-xl soft-inset text-xs font-medium outline-none text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 font-bold">Option C</label>
                            <input
                              type="text"
                              required
                              value={q.option_c}
                              onChange={(e) => updateQuestionField(idx, "option_c", e.target.value)}
                              placeholder="Option C"
                              className="w-full px-3 py-2 rounded-xl soft-inset text-xs font-medium outline-none text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1 font-bold">Option D</label>
                            <input
                              type="text"
                              required
                              value={q.option_d}
                              onChange={(e) => updateQuestionField(idx, "option_d", e.target.value)}
                              placeholder="Option D"
                              className="w-full px-3 py-2 rounded-xl soft-inset text-xs font-medium outline-none text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
                          <div>
                            <label className="block text-slate-700 font-bold mb-1">
                              Correct Answer
                            </label>
                            <select
                              value={q.correct_answer}
                              onChange={(e) => updateQuestionField(idx, "correct_answer", e.target.value)}
                              className="w-full px-3 py-2 rounded-xl soft-inset bg-emerald-50 text-emerald-900 font-bold outline-none"
                            >
                              <option value="a">Option A</option>
                              <option value="b">Option B</option>
                              <option value="c">Option C</option>
                              <option value="d">Option D</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-700 font-bold mb-1">Marks</label>
                            <input
                              type="number"
                              required
                              min={0.25}
                              step={0.25}
                              value={q.marks}
                              onChange={(e) => updateQuestionField(idx, "marks", Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl soft-inset text-xs font-bold outline-none text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    disabled={editorSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 soft-button"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editorSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white soft-button-primary disabled:opacity-50"
                  >
                    {editorSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Quiz"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CSV Quiz Import Modal (Soft UI) */}
      {isCsvModalOpen && (
        <div className="soft-modal-overlay" onClick={() => setIsCsvModalOpen(false)}>
          <div className="soft-modal-content max-w-3xl w-full p-6 sm:p-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--lo)]">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[var(--acc2)]" />
                <h3 className="text-xl font-black text-[var(--ink)]">Create Quiz from CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center soft-button cursor-pointer text-[var(--mute)]"
              >
                ✕
              </button>
            </div>

            <div className="py-2 space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 soft-card-subtle">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Quiz Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={csvTitle}
                    onChange={(e) => setCsvTitle(e.target.value)}
                    placeholder="e.g. Science Quiz 2026"
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold soft-inset text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={csvDuration}
                    onChange={(e) => setCsvDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold soft-inset text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Countdown (Seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={csvCountdown}
                    onChange={(e) => setCsvCountdown(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold soft-inset text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input
                    id="csv-show-score"
                    type="checkbox"
                    checked={csvShowScore}
                    onChange={(e) => setCsvShowScore(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="csv-show-score" className="text-xs font-bold text-slate-700">
                    Show score to student
                  </label>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center soft-inset">
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvSelect}
                  className="hidden"
                  id="quiz-csv-file-picker"
                />
                <label
                  htmlFor="quiz-csv-file-picker"
                  className="cursor-pointer inline-flex flex-col items-center justify-center"
                >
                  <Upload className="w-10 h-10 text-emerald-600 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    {csvFile ? csvFile.name : "Click to select Questions CSV"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Columns: question, option_a, option_b, option_c, option_d, correct_answer, marks
                  </span>
                </label>
              </div>

              {csvPreviewing && (
                <div className="p-8 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                  <p className="text-xs font-bold">Validating question rows...</p>
                </div>
              )}

              {csvPreviewData && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 soft-pill">
                      Total: {csvPreviewData.totalRows}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 soft-pill">
                      Valid: {csvPreviewData.validCount}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 soft-pill">
                      Errors: {csvPreviewData.invalidCount}
                    </span>
                  </div>

                  <div className="rounded-2xl overflow-hidden soft-inset max-h-56 overflow-y-auto text-xs p-2">
                    <table className="w-full text-left">
                      <thead className="bg-slate-200/50 text-slate-600 sticky top-0 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Question</th>
                          <th className="px-3 py-2">Answer</th>
                          <th className="px-3 py-2">Marks</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60">
                        {csvPreviewData.previewRows.map((r) => (
                          <tr key={r.rowIndex} className={r.isValid ? "hover:bg-white/40" : "bg-red-50/60"}>
                            <td className="px-3 py-2 font-mono text-slate-500">#{r.rowIndex}</td>
                            <td className="px-3 py-2 font-bold max-w-xs truncate text-slate-800">{r.question || "—"}</td>
                            <td className="px-3 py-2 uppercase font-mono font-black text-emerald-700">
                              {r.correct_answer || "—"}
                            </td>
                            <td className="px-3 py-2 font-mono">{r.marks}</td>
                            <td className="px-3 py-2">
                              {r.isValid ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <SquareCheck className="w-3.5 h-3.5" /> Valid
                                </span>
                              ) : (
                                <span className="text-red-600 font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {r.errorMessage}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(false)}
                disabled={csvImporting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 soft-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportQuizCsv}
                disabled={!csvPreviewData || csvPreviewData.validCount === 0 || csvImporting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white soft-button-success disabled:opacity-50"
              >
                {csvImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create Quiz with ${csvPreviewData?.validCount ?? 0} Questions`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Soft UI) */}
      {deletingQuiz && (
        <div className="soft-modal-overlay" onClick={() => setDeletingQuiz(null)}>
          <div className="soft-modal-content max-w-md w-full p-6 sm:p-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="ico text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-[var(--ink)]">Delete Quiz</h3>
            <p className="text-xs text-[var(--mute)] leading-relaxed font-medium">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-[var(--ink)]">&quot;{deletingQuiz.title}&quot;</span>? This will
              cascade delete all its questions, student attempts, and recorded scores.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingQuiz(null)}
                disabled={isDeleting}
                className="soft-button cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteQuiz}
                disabled={isDeleting}
                className="soft-button-danger disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Quiz"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
