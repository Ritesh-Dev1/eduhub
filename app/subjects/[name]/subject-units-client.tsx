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
import {
  getNotesAction,
  getNoteSignedUrlAction,
  type NoteItem,
} from "@/app/actions/notes";
import {
  FileText,
  Download,
  Eye,
  Loader2,
  ArrowLeft,
  BookOpen,
  Calendar,
} from "lucide-react";

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

interface SubjectUnitsClientProps {
  subjectName: string;
}

export function SubjectUnitsClient({ subjectName }: SubjectUnitsClientProps) {
  const decodedSubject = decodeURIComponent(subjectName);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Preview dialog modal state
  const [previewNote, setPreviewNote] = useState<NoteItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 5-second native ad download dialog state
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

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getNotesAction();
      if (res.ok) {
        // Filter notes for this specific subject
        const filtered = res.data.notes.filter(
          (n) => n.subject.toLowerCase() === decodedSubject.toLowerCase()
        );
        setNotes(filtered);
      }
      setLoading(false);
    }
    loadData();
  }, [decodedSubject]);

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

  const icon = DEFAULT_ICONS[decodedSubject.toLowerCase()] || "📖";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col selection:bg-[var(--acc)] selection:text-white">
      <PublicHeader />

      <main className="wrap flex-1 w-full py-6 sm:py-8 space-y-8">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/#subjects"
            className="btn text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Subjects</span>
          </Link>

          <Link
            href="/quizzes"
            className="text-xs font-bold text-[var(--mute)] hover:text-[var(--ink)] transition-colors"
            style={{ textDecoration: "none" }}
          >
            Take Quizzes &rarr;
          </Link>
        </div>

        {/* Banner Ad: After Navigation */}
        <AdsterraLeaderboard728x90 />

        {/* Subject Header Banner (Soft UI) */}
        <section className="card p-6 sm:p-10 relative overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div
              className="ico shrink-0 text-3xl w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "var(--bg)",
                boxShadow: "var(--raise)",
              }}
            >
              {icon}
            </div>

            <div className="space-y-1.5 min-w-0 flex-1">
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
              >
                Department Syllabus Units
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
                {decodedSubject}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--mute)] font-medium max-w-2xl">
                Official curriculum lecture units, verified PDF revision notes, and reference materials.
              </p>
            </div>

            <div
              className="px-4 py-2.5 rounded-2xl text-center self-start sm:self-auto shrink-0"
              style={{ background: "var(--bg)", boxShadow: "var(--press)" }}
            >
              <div className="text-lg font-black text-[var(--acc)]">
                {notes.length}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--mute)]">
                {notes.length === 1 ? "Unit Available" : "Units Available"}
              </div>
            </div>
          </div>
        </section>

        {/* 728x90 Leaderboard Ad: Top placement below Subject Header */}
        <AdsterraLeaderboard728x90 />

        {/* Units Content Section */}
        <section className="space-y-6">
          <div className="head">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] tracking-tight">
              Curriculum Units &amp; Notes
            </h2>
            <p className="text-xs sm:text-sm text-[var(--mute)] font-medium mt-1">
              Select any unit to read in-browser or download with verified institutional access.
            </p>
          </div>

          {loading && (
            <div className="py-20 text-center text-[var(--mute)]">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
              <p className="text-xs font-bold">Loading syllabus units from repository...</p>
            </div>
          )}

          {!loading && notes.length === 0 && (
            <div className="card text-center p-12 space-y-3">
              <BookOpen className="w-12 h-12 text-[var(--mute)] opacity-30 mx-auto mb-1" />
              <h3 className="text-base font-bold text-[var(--ink)]">No units uploaded yet</h3>
              <p className="text-xs text-[var(--mute)] max-w-md mx-auto">
                No syllabus notes are currently available for &quot;{decodedSubject}&quot;.
                Please check back later or check other departments.
              </p>
              <div className="pt-2">
                <Link href="/#subjects" className="btn pri text-xs font-bold">
                  Browse Other Subjects
                </Link>
              </div>
            </div>
          )}

          {/* Units Grid */}
          {!loading && notes.length > 0 && (
            <div className="units-responsive-grid">
              {notes.map((note, idx) => (
                <Fragment key={note.id}>
                  <article className="card justify-between hover:-translate-y-1 transition-all" style={{ minHeight: "240px" }}>
                    <div className="space-y-4">
                      {/* Top Unit Pill & Metadata */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="pill text-xs font-bold">
                          Unit {idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--mute)] font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {new Date(note.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span>&bull;</span>
                          <span className="font-mono font-semibold">
                            {formatBytes(note.file_size)}
                          </span>
                        </div>
                      </div>

                      {/* Title & Document File Name */}
                      <div className="flex items-start gap-3.5 pt-1">
                        <div className="ico shrink-0 text-red-500">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-[var(--ink)] text-base line-clamp-2 leading-snug">
                            {note.title}
                          </h3>
                          <p className="text-xs text-[var(--mute)] truncate mt-1">
                            {note.file_name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: 2-column grid spanning 100% width with no overflow */}
                    <div className="pt-3.5 mt-3 border-t border-[var(--lo)] grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handlePreview(note)}
                        className="btn text-xs font-bold cursor-pointer justify-center !py-2.5 !px-2 w-full"
                        title="Preview PDF"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDownloadNote(note)}
                        className="btn pri text-xs font-bold cursor-pointer justify-center !py-2.5 !px-2 w-full"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Download</span>
                      </button>
                    </div>
                  </article>

                  {/* 300x250 Medium Rectangle Ad Card: between every 2 unit cards */}
                  {(idx + 1) % 2 === 0 && (
                    <AdsterraCard300x250 key={`ad-subject-unit-${idx}`} />
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </section>

        {/* 468x60 Banner Ad: Bottom of units */}
        <AdsterraBanner468x60 />

        <footer>Softshelf · Study notes &amp; quizzes &bull; {decodedSubject} Units</footer>
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
