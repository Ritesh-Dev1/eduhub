"use client";

import { Fragment, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { AdBanner } from "@/components/ad-banner";
import {
  AdsterraCard300x250,
  AdsterraLeaderboard728x90,
  AdsterraBanner468x60,
} from "@/components/adsterra-banner";
import { getNotesAction, type NoteItem } from "@/app/actions/notes";
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

  // Quizzes filter chip
  const [quizFilter, setQuizFilter] = useState("All");

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
         <AdsterraLeaderboard728x90 />

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
              {subjectGroups.map((subject, idx) => (
                <Fragment key={subject.name}>
                  <Link
                    href={`/subjects/${encodeURIComponent(subject.name)}`}
                    className="card subj"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span className="ico" aria-hidden="true">
                      {subject.icon}
                    </span>
                    <h3>{subject.name}</h3>
                    <span className="meta">
                      {subject.notes.length} {subject.notes.length === 1 ? "unit" : "units"} · PDF notes
                    </span>
                    <span className="pill">
                      View units &rarr;
                    </span>
                  </Link>
                  {(idx + 1) % 2 === 0 && (
                    <AdsterraCard300x250 key={`ad-subject-${idx}`} />
                  )}
                </Fragment>
              ))}
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
    </div>
  );
}
