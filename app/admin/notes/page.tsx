"use client";

import { useEffect, useState, useRef } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  BookOpen,
} from "lucide-react";
import {
  getNotesAction,
  getSignedUploadUrlAction,
  createNoteRecordAction,
  deleteNoteAction,
  getNoteSignedUrlAction,
  uploadNoteServerAction,
  type NoteItem,
} from "@/app/actions/notes";

export default function AdminNotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upload Form state
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Dialog state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);

  async function loadNotes() {
    setLoading(true);
    setError(null);
    const res = await getNotesAction();
    if (!res.ok) {
      setError(res.message);
    } else {
      setNotes(res.data.notes);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File exceeds 20 MB size limit. Please select a smaller PDF.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a PDF file to upload.");
      return;
    }
    if (!title.trim() || !subject.trim()) {
      setError("Please provide both title and subject.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setError(null);
    setSuccess(null);

    try {
      const prepRes = await getSignedUploadUrlAction(selectedFile.name, selectedFile.size);

      if (prepRes.ok) {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", prepRes.data.signedUrl);
        xhr.setRequestHeader("Content-Type", "application/pdf");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 80) + 10;
            setUploadProgress(percent);
          }
        };

        const uploadPromise = new Promise<{ ok: boolean; status: number }>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ ok: true, status: xhr.status });
            } else {
              reject(new Error("Storage upload failed"));
            }
          };
          xhr.onerror = () => reject(new Error("Network error during storage upload"));
        });

        xhr.send(selectedFile);
        await uploadPromise;
        setUploadProgress(95);

        const recordRes = await createNoteRecordAction({
          title: title.trim(),
          subject: subject.trim(),
          filePath: prepRes.data.filePath,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
        });

        if (!recordRes.ok) {
          setError(recordRes.message);
        } else {
          setSuccess("Note uploaded successfully!");
          resetForm();
          loadNotes();
        }
      } else {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("subject", subject.trim());
        formData.append("file", selectedFile);

        const serverRes = await uploadNoteServerAction(formData);
        if (!serverRes.ok) {
          setError(serverRes.message);
        } else {
          setSuccess("Note uploaded successfully!");
          resetForm();
          loadNotes();
        }
      }
    } catch {
      setError("We couldn't upload your file. Please check that it is a PDF under 20 MB and try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function resetForm() {
    setTitle("");
    setSubject("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmDelete() {
    if (!noteToDelete) return;
    setDeletingId(noteToDelete.id);
    const res = await deleteNoteAction(noteToDelete.id);
    if (!res.ok) {
      setError(res.message);
    } else {
      setSuccess("Note and storage file deleted successfully.");
      setNoteToDelete(null);
      loadNotes();
    }
    setDeletingId(null);
  }

  async function openNote(noteId: string, download: boolean) {
    const res = await getNoteSignedUrlAction(noteId, download);
    if (!res.ok) {
      setError(res.message);
    } else {
      window.open(res.data.signedUrl, "_blank");
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
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">Study Notes Management</h1>
        <p className="text-xs sm:text-sm text-[var(--mute)] font-medium mt-1">
          Upload and manage official lecture notes and reference documents for students
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div
          className="soft-card p-4 flex items-start gap-3"
          style={{ border: "1px solid #e05260" }}
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-red-500">{error}</p>
        </div>
      )}
      {success && (
        <div
          className="soft-card p-4 flex items-start gap-3"
          style={{ border: "1px solid var(--acc2)" }}
        >
          <CheckCircle2 className="w-5 h-5 text-[var(--acc2)] shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-[var(--acc2)]">{success}</p>
        </div>
      )}

      {/* Upload Form Card (Soft UI) */}
      <div className="soft-card p-5 sm:p-8">
        <h2 className="text-base font-extrabold text-[var(--ink)] mb-5 flex items-center gap-2">
          <Upload className="w-5 h-5 text-[var(--acc)]" />
          Upload New PDF Note
        </h2>

        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--mute)] mb-2">
                Note Title
              </label>
              <input
                type="text"
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chapter 4: Thermodynamics & Heat Transfer"
                className="soft-input w-full px-4 py-3 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--mute)] mb-2">
                Subject / Course
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics, Data Structures, Calculus"
                className="soft-input w-full px-4 py-3 text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--mute)] mb-2">
              PDF Document (Max 20 MB)
            </label>
            <div className="p-4 rounded-xl" style={{ boxShadow: "var(--press)", background: "var(--bg)" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                required
                onChange={handleFileChange}
                className="block w-full text-xs text-[var(--mute)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[var(--acc)] file:text-[var(--onacc)] file:cursor-pointer cursor-pointer"
              />
            </div>
            {selectedFile && (
              <p className="text-xs text-[var(--mute)] mt-2 font-medium">
                Selected: <span className="font-bold text-[var(--ink)]">{selectedFile.name}</span> (
                {formatBytes(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-[var(--mute)] font-bold">
                <span>Uploading to storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full rounded-full h-2.5 overflow-hidden p-0.5" style={{ boxShadow: "var(--press)" }}>
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%`, background: "var(--acc)" }}
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="soft-button-primary disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Note
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Notes List Section */}
      <div className="soft-card overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[var(--lo)] flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[var(--acc)]" />
            <h2 className="text-base font-bold text-[var(--ink)]">All Published Notes</h2>
            <span
              className="text-xs px-3 py-1 rounded-full font-bold"
              style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
            >
              {notes.length} Total
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[var(--mute)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or subject..."
              className="soft-input w-full pl-10 pr-4 py-2 text-xs font-medium"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-16 text-center text-[var(--mute)]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
            <p className="text-xs font-bold">Loading notes from database...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredNotes.length === 0 && (
          <div className="p-16 text-center text-[var(--mute)]">
            <FileText className="w-12 h-12 mx-auto opacity-30 mb-3" />
            <p className="text-base font-bold text-[var(--ink)]">No notes found</p>
            <p className="text-xs text-[var(--mute)] mt-1">
              {search ? "No notes matched your search query." : "Upload your first PDF note above."}
            </p>
          </div>
        )}

        {/* Desktop & Tablet Table of Notes */}
        {!loading && filteredNotes.length > 0 && (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--lo)] text-xs font-bold text-[var(--mute)] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Title &amp; File</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Uploaded Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lo)]">
                  {filteredNotes.map((note) => (
                    <tr key={note.id} className="hover:bg-[var(--lo)]/10 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="ico shrink-0 !w-10 !h-10 !rounded-xl !text-sm">
                            <FileText className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="font-bold text-[var(--ink)]">{note.title}</p>
                            <p className="text-xs text-[var(--mute)] truncate max-w-xs">{note.file_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                          style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                        >
                          {note.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--mute)] font-mono text-xs font-semibold">
                        {formatBytes(note.file_size)}
                      </td>
                      <td className="px-6 py-4 text-[var(--mute)] text-xs font-medium">
                        {new Date(note.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        <button
                          onClick={() => openNote(note.id, false)}
                          title="View PDF"
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--ink)] hover:text-[var(--acc)] active:shadow-[var(--press)] cursor-pointer"
                          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openNote(note.id, true)}
                          title="Download PDF"
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--ink)] hover:text-[var(--acc2)] active:shadow-[var(--press)] cursor-pointer"
                          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setNoteToDelete(note)}
                          title="Delete Note"
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-red-500 hover:text-red-700 active:shadow-[var(--press)] cursor-pointer"
                          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-Based List (Full Mobile Responsiveness) */}
            <div className="sm:hidden divide-y divide-[var(--lo)]">
              {filteredNotes.map((note) => (
                <div key={note.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                        style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                      >
                        {note.subject}
                      </span>
                      <p className="font-bold text-sm text-[var(--ink)] leading-snug">{note.title}</p>
                      <p className="text-[11px] text-[var(--mute)] truncate max-w-[240px]">{note.file_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--mute)] pt-1">
                    <span className="font-mono font-semibold">{formatBytes(note.file_size)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openNote(note.id, false)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink)]"
                        style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openNote(note.id, true)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--acc2)]"
                        style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setNoteToDelete(note)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-red-500"
                        style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal (Soft UI) */}
      {noteToDelete && (
        <div className="soft-modal-overlay" onClick={() => setNoteToDelete(null)}>
          <div className="soft-modal-content max-w-md w-full p-6 sm:p-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="ico text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-[var(--ink)]">Delete Study Note</h3>
            <p className="text-xs text-[var(--mute)] leading-relaxed font-medium">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-[var(--ink)]">&quot;{noteToDelete.title}&quot;</span>? This will
              remove both the database record and the PDF file from storage.
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setNoteToDelete(null)}
                disabled={!!deletingId}
                className="soft-button cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!!deletingId}
                className="soft-button-danger disabled:opacity-50 cursor-pointer"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Note"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
