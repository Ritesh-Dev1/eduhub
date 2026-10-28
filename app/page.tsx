"use client";

import { Fragment, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { AdBanner } from "@/components/ad-banner";
import { DownloadDialog } from "@/components/download-dialog";
import {
  AdsterraCard300x250,
  AdsterraLeaderboard728x90,
  AdsterraBanner468x60,
} from "@/components/adsterra-banner";
import { getNotesAction, getNoteSignedUrlAction, type NoteItem } from "@/app/actions/notes";
import { getQuizzesAction, type QuizListItem } from "@/app/actions/quizzes";
import { Loader2 } from "lucide-react";

interface SubjectGroup {
  name: string;
  icon: string;
  notes: NoteItem[];
}

const DEFAULT_ICONS: Record<string, string> = {
  mathematics: "∑",
  math: "∑",
  physics: "⚛",
  chemistry: "⚗",
  biology: "🧬",
  english: "✎",
  "computer science": "⌨",
  cs: "⌨",
};

export default function HomePage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected subject for horizontal units track
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Quizzes filter chip
  const [quizFilter, setQuizFilter] = useState("All");

  // Dialog preview modal state
  const [previewNote, setPreviewNote] = useState<NoteItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Download ad countdown modal state
  const [downloadNote, setDownloadNote] = useState<NoteItem | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }

  // Load real notes and quizzes from remote database
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [notesRes, quizzesRes] = await Promise.all([
        getNotesAction(),
        getQuizzesAction(),
      ]);

      if (notesRes.ok) setNotes(notesRes.data.notes);
      if (quizzesRes.ok) setQuizzes(quizzesRes.data.quizzes);
      setLoading(false);
    }
    loadData();
  }, []);

  // Group notes into subjects
  const subjectGroups: SubjectGroup[] = [];
  const subjectMap = new Map<string, NoteItem[]>();

  notes.forEach((note) => {
    const list = subjectMap.get(note.subject) || [];
    list.push(note);
    subjectMap.set(note.subject, list);
  });

  subjectMap.forEach((subjectNotes, subjectName) => {
    const lower = subjectName.toLowerCase();
    const icon = DEFAULT_ICONS[lower] || "📖";
    subjectGroups.push({
      name: subjectName,
      icon,
      notes: subjectNotes,
    });
  });

  function openSubject(index: number) {
    setSelectedSubjectIndex(index);
    setTimeout(() => {
      const unitsEl = document.getElementById("units");
      if (unitsEl) {
        unitsEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  }

  function scrollTrack(direction: number) {
    if (trackRef.current) {
      const step = 320 * direction;
      trackRef.current.scrollBy({ left: step, behavior: "smooth" });
    }
  }

  async function handlePreview(note: NoteItem) {
    setPreviewNote(note);
    setPreviewLoading(true);
    setPreviewUrl(null);

    const res = await getNoteSignedUrlAction(note.id, false);
    if (res.ok) {
      setPreviewUrl(res.data.signedUrl);
    } else {
      showToast(res.message);
    }
    setPreviewLoading(false);
  }

  async function handleDownload(note: NoteItem) {
    showToast(`Downloading ${note.file_name}…`);
    const res = await getNoteSignedUrlAction(note.id, true);
    if (res.ok) {
      window.open(res.data.signedUrl, "_blank");
    } else {
      showToast(res.message);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  const activeSubject =
    selectedSubjectIndex !== null ? subjectGroups[selectedSubjectIndex] : null;

  // Filtered quizzes
  const allSubjectNames = ["All", ...subjectGroups.map((s) => s.name)];
  const filteredQuizzes = quizzes.filter(
    (q) => quizFilter === "All" || q.title.toLowerCase().includes(quizFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="wrap flex-1 w-full">
        {/* Banner Ad: After Navbar */}
        <AdBanner />

        {/* Eduhub Hero Section */}
        <section className="hero">
          <div>
            <h1>Study notes and quizzes, in one calm place.</h1>
            <p>
              Open a subject, preview any unit, download the PDF, then test yourself with a timed quiz.
            </p>
            <div data-banner-id="1505551"></div>
            <div className="flex items-center gap-3">
              <a className="btn pri" href="#subjects">
                Browse subjects
              </a>
              <a className="btn" href="#quizzes">
                Take a quiz
              </a>
            </div>
          </div>

          <div className="devices" aria-hidden="true">
            <div className="laptop">
              <div className="screen">
                <div className="bar" />
                <div className="mini">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="bar" style={{ width: "35%" }} />
                <div className="hscroll">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="base" />
            </div>
            <div className="phone">
              <div className="screen">
                <div className="bar" style={{ width: "50%" }} />
                <div className="mrow">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 728x90 Leaderboard Ad: Top placement below Hero */}
        <AdsterraLeaderboard728x90 />

        {/* Subjects Section */}
        <section id="subjects">
          <div className="head">
            <h2>Subjects</h2>
            <p>Pick a subject to explore its syllabus units and notes.</p>
          </div>

          {loading && (
            <div className="p-16 text-center" style={{ color: "var(--mute)" }}>
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[var(--acc)]" />
              <p>Loading subjects from repository...</p>
            </div>
          )}

          {!loading && subjectGroups.length === 0 && (
            <div className="card text-center p-12">
              <p style={{ color: "var(--mute)" }}>
                No study notes have been uploaded to the database yet. Visit the{" "}
                <Link href="/admin" className="font-bold underline text-[var(--acc)]">
                  Admin Panel
                </Link>{" "}
                to upload PDF notes.
              </p>
            </div>
          )}

          {/* Subjects Grid */}
          {!loading && subjectGroups.length > 0 && (
            <div className="grid">
              {subjectGroups.map((subject, idx) => {
                const isExpanded = selectedSubjectIndex === idx;

                return (
                  <Fragment key={subject.name}>
                    <button
                      className="card subj"
                      aria-expanded={isExpanded}
                      onClick={() => openSubject(idx)}
                      style={{ cursor: "pointer", border: 0 }}
                    >
                      <span className="ico" aria-hidden="true">
                        {subject.icon}
                      </span>
                      <h3>{subject.name}</h3>
                      <span className="meta">
                        {subject.notes.length} {subject.notes.length === 1 ? "unit" : "units"} · PDF notes
                      </span>
                      <span className="pill">
                        {isExpanded ? "Units open" : "Open units"}
                      </span>
                    </button>
                    {(idx + 1) % 2 === 0 && (
                      <AdsterraCard300x250 key={`ad-subject-${idx}`} />
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}

          {/* Units Horizontal Slider Track */}
          {activeSubject && (
            <div id="units" className="show">
              <div className="uhead">
                <div>
                  <h3>{activeSubject.name}</h3>
                  <p className="meta">
                    {activeSubject.notes.length} units available. Swipe or use the arrows.
                  </p>
                </div>
                <div className="arrows">
                  <button
                    className="btn"
                    onClick={() => scrollTrack(-1)}
                    aria-label="Scroll units left"
                  >
                    ←
                  </button>
                  <button
                    className="btn"
                    onClick={() => scrollTrack(1)}
                    aria-label="Scroll units right"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="track" ref={trackRef}>
                {activeSubject.notes.map((note, k) => (
                  <Fragment key={note.id}>
                    <article className="card unit">
                      <span className="pill" style={{ alignSelf: "flex-start" }}>
                        Unit {k + 1}
                      </span>
                      <h3>{note.title}</h3>
                      <p style={{ color: "var(--mute)", fontSize: "14.5px", flex: 1 }}>
                        Official curriculum document verified by department faculty.
                      </p>
                      <span className="size">PDF · {formatBytes(note.file_size)}</span>
                      <div className="acts">
                        <button className="btn" onClick={() => handlePreview(note)}>
                          Preview
                        </button>
                        <button className="btn pri" onClick={() => setDownloadNote(note)}>
                          Download
                        </button>
                      </div>
                    </article>
                    {(k + 1) % 2 === 0 && (
                      <AdsterraCard300x250 variant="unit" key={`ad-unit-${k}`} />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 468x60 Banner Ad: Transition between Subjects and Quizzes */}
        <AdsterraBanner468x60 />

        {/* Banner Ad: After Subjects Section */}
        <AdBanner />

        {/* Quizzes Section */}
        <section id="quizzes">
          <div className="head">
            <h2>Quizzes</h2>
            <p>Every proctored quiz and assessment across all subjects.</p>
          </div>

          {/* Filter Chips */}
          <div className="chips" role="group" aria-label="Filter quizzes by subject">
            {allSubjectNames.map((n) => (
              <button
                key={n}
                className="chip"
                aria-pressed={quizFilter === n}
                onClick={() => setQuizFilter(n)}
              >
                {n}
              </button>
            ))}
          </div>

          {loading && (
            <div className="p-16 text-center" style={{ color: "var(--mute)" }}>
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[var(--acc)]" />
              <p>Loading scheduled quizzes...</p>
            </div>
          )}

          {!loading && filteredQuizzes.length === 0 && (
            <div className="card text-center p-12 mt-6">
              <p style={{ color: "var(--mute)" }}>
                No active quizzes found. Visit the{" "}
                <Link href="/admin" className="font-bold underline text-[var(--acc)]">
                  Admin Panel
                </Link>{" "}
                to create quizzes or import questions via CSV.
              </p>
            </div>
          )}

          {/* Quizzes Grid */}
          {!loading && filteredQuizzes.length > 0 && (
            <div className="grid quiz mt-6">
              {filteredQuizzes.map((q, idx) => {
                const canEnter = q.status === "open" || q.status === "live";

                return (
                  <Fragment key={q.id}>
                    <article className="card">
                      <span className="pill" style={{ alignSelf: "flex-start" }}>
                        {q.status === "live" ? "Live Exam" : q.status === "open" ? "Registration Open" : "Upcoming"}
                      </span>
                      <h3>{q.title}</h3>
                      <div className="row">
                        <span>{q.question_count} questions</span>
                        <span>{q.duration_minutes} min</span>
                      </div>

                      <div className="bars" role="img" aria-label="Exam status">
                        <b style={{ width: q.status === "live" ? "100%" : "60%" }} />
                      </div>

                      <div className="row">
                        <span>{q.total_marks} total marks</span>
                        <span>{q.show_score ? "Instant score" : "Reviewed"}</span>
                      </div>

                      {canEnter ? (
                        <Link
                          href={`/quizzes/${q.id}`}
                          className="btn pri"
                          style={{ alignSelf: "flex-start" }}
                        >
                          {q.status === "live" ? "Enter live exam" : "Join waiting room"}
                        </Link>
                      ) : (
                        <span className="btn" style={{ alignSelf: "flex-start", opacity: 0.6, cursor: "not-allowed" }}>
                          {q.status === "closed" ? "Exam ended" : "Not open"}
                        </span>
                      )}
                    </article>
                    {(idx + 1) % 2 === 0 && (
                      <AdsterraCard300x250 key={`ad-quiz-${idx}`} />
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </section>

        {/* Banner Ad: After Quiz Section */}
        <AdBanner />

        <footer>Eduhub · Study notes &amp; quizzes &bull;&bull; Proctored Assessments</footer>
      </main>

      {/* Preview Dialog Modal */}
      {previewNote && (
        <div className="soft-modal-overlay p-4" onClick={() => setPreviewNote(null)}>
          <div
            className="soft-modal-content max-w-lg w-full p-6 sm:p-8 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black text-[var(--ink)]">{previewNote.title}</h3>
            <p className="text-xs text-[var(--mute)] font-medium">
              {previewNote.subject} &bull; {formatBytes(previewNote.file_size)}
            </p>

            <div className="doc py-2">
              {previewLoading ? (
                <div className="py-8 text-center" style={{ color: "var(--mute)" }}>
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--acc)]" />
                  <p className="text-xs font-bold">Generating secure signed preview...</p>
                </div>
              ) : previewUrl ? (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "var(--mute)" }}>
                    Secure 3600-second access link generated for <strong>{previewNote.file_name}</strong>.
                  </p>
                  <iframe
                    src={previewUrl}
                    className="w-full h-64 rounded-xl border border-[var(--lo)]"
                    title="PDF Preview"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bar" />
                  <div className="bar" />
                  <div className="bar" />
                  <div className="bar" style={{ width: "40%" }} />
                  <div className="bar" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--lo)]">
              <button
                className="btn pri"
                onClick={() => {
                  setDownloadNote(previewNote);
                  setPreviewNote(null);
                }}
              >
                Download PDF
              </button>
              <button className="btn" onClick={() => setPreviewNote(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-Second Native Ad Download Dialog */}
      <DownloadDialog
        note={downloadNote}
        isOpen={!!downloadNote}
        onClose={() => setDownloadNote(null)}
        onDownload={handleDownload}
      />

      {/* Floating Toast */}
      <div className={`toast ${toastMessage ? "on" : ""}`} role="status">
        {toastMessage}
      </div>
    </div>
  );
}
