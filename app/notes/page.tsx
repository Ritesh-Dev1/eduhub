"use client";

import { Fragment, useEffect, useState } from "react";
import { PublicHeader } from "@/components/public-header";
import { AdBanner } from "@/components/ad-banner";
import { DownloadDialog } from "@/components/download-dialog";
import {
  AdsterraCard300x250,
  AdsterraLeaderboard728x90,
  AdsterraBanner468x60,
} from "@/components/adsterra-banner";
import {
  FileText,
  Search,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  BookOpen,
  Filter,
} from "lucide-react";
import { getNotesAction, getNoteSignedUrlAction, type NoteItem } from "@/app/actions/notes";

export default function PublicNotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [downloadNote, setDownloadNote] = useState<NoteItem | null>(null);

  async function loadNotes() {
    setLoading(true);
    setError(null);
    const res = await getNotesAction();
    if (!res.ok) {
      setError(res.message);
    } else {
      setNotes(res.data.notes);
      setSubjects(res.data.subjects);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function handleOpenNote(noteId: string, download: boolean) {
    setActionLoadingId(`${noteId}-${download ? "dl" : "view"}`);
    try {
      const res = await getNoteSignedUrlAction(noteId, download);
      if (!res.ok) {
        setError(res.message);
      } else {
        window.open(res.data.signedUrl, "_blank");
      }
    } catch {
      setError("We couldn't generate the file access link. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  const filteredNotes = notes.filter((n) => {
    const matchesQuery =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.subject.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === "ALL" || n.subject === selectedSubject;
    return matchesQuery && matchesSubject;
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col selection:bg-[var(--acc)] selection:text-white">
      <PublicHeader />

      <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        {/* Banner Ad: After Navbar */}
        <AdBanner />

        {/* Soft UI Banner */}
        <div className="card p-6 sm:p-10 relative overflow-hidden">
          <div className="max-w-2xl space-y-3 relative z-10">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
            >
              <BookOpen className="w-3.5 h-3.5" /> Department Repository
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
              Course Lecture Notes &amp; Syllabus
            </h1>
            <p className="text-sm sm:text-base text-[var(--mute)] font-medium">
              Access and download official syllabus materials, course outlines, and revision PDFs verified by your department.
            </p>
          </div>
        </div>

        {/* 728x90 Leaderboard Ad: Below repository header */}
        <AdsterraLeaderboard728x90 />

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
                onClick={loadNotes}
                className="text-xs font-bold text-red-600 underline mt-1 cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Soft Recessed Search & Filter Bar */}
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-[var(--mute)] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes by title or subject..."
              className="soft-input w-full pl-11 pr-4 py-2.5 text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[var(--mute)] shrink-0" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="soft-input w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold"
            >
              <option value="ALL" className="bg-[var(--bg)] text-[var(--ink)]">All Subjects ({notes.length})</option>
              {subjects.map((sub) => (
                <option key={sub} value={sub} className="bg-[var(--bg)] text-[var(--ink)]">
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-24 text-center text-[var(--mute)]">
            <Loader2 className="w-9 h-9 animate-spin mx-auto text-[var(--acc)] mb-3" />
            <p className="text-sm font-bold text-[var(--ink)]">Loading repository notes...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredNotes.length === 0 && (
          <div className="py-20 card text-center p-8">
            <FileText className="w-12 h-12 text-[var(--mute)] mx-auto mb-3 opacity-30" />
            <h3 className="text-base font-bold text-[var(--ink)]">No notes available</h3>
            <p className="text-xs text-[var(--mute)] max-w-sm mx-auto mt-1">
              {search || selectedSubject !== "ALL"
                ? "No documents matched your search criteria. Try adjusting your search."
                : "No study notes have been uploaded by the department yet."}
            </p>
          </div>
        )}

        {/* Notes Grid (Soft UI Cards) */}
        {!loading && filteredNotes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNotes.map((note, idx) => {
              const isViewing = actionLoadingId === `${note.id}-view`;
              const isDownloading = actionLoadingId === `${note.id}-dl`;

              return (
                <Fragment key={note.id}>
                  <div
                    className="card justify-between space-y-4 hover:-translate-y-1 transition-all"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                          style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                        >
                          {note.subject}
                        </span>
                        <span className="text-xs text-[var(--mute)] font-mono font-semibold">
                          {formatBytes(note.file_size)}
                        </span>
                      </div>

                      <div className="flex items-start gap-3.5">
                        <div className="ico shrink-0 text-red-500">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-[var(--ink)] text-base line-clamp-2 leading-snug">
                            {note.title}
                          </h3>
                          <p className="text-xs text-[var(--mute)] truncate mt-1">{note.file_name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--lo)] flex items-center justify-between text-xs text-[var(--mute)]">
                      <span className="font-medium">
                        {new Date(note.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenNote(note.id, false)}
                          disabled={isViewing || isDownloading}
                          className="btn text-xs font-bold disabled:opacity-50 cursor-pointer"
                          title="View PDF"
                        >
                          {isViewing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => setDownloadNote(note)}
                          disabled={isViewing || isDownloading}
                          className="btn pri text-xs font-bold disabled:opacity-50 cursor-pointer"
                          title="Download PDF"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Get</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {(idx + 1) % 2 === 0 && (
                    <AdsterraCard300x250 key={`ad-note-${idx}`} />
                  )}
                </Fragment>
              );
            })}
          </div>
        )}

        {/* 468x60 Banner Ad: Bottom of repository */}
        <AdsterraBanner468x60 />

        {/* Banner Ad: Subject Section */}
        <AdBanner />
      </main>

      {/* 5-Second Native Ad Download Dialog */}
      <DownloadDialog
        note={downloadNote}
        isOpen={!!downloadNote}
        onClose={() => setDownloadNote(null)}
        onDownload={(n) => handleOpenNote(n.id, true)}
      />
    </div>
  );
}
