"use client";

import { useEffect, useState, useRef } from "react";
import {
  Users,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import {
  getStudentsAction,
  createStudentAction,
  updateStudentAction,
  deleteStudentAction,
  previewStudentsCsvAction,
  importStudentsAction,
  type StudentRecord,
  type StudentCsvRowPreview,
} from "@/app/actions/students";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [formName, setFormName] = useState("");
  const [formRollNumber, setFormRollNumber] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // CSV Import State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewing, setCsvPreviewing] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<{
    previewRows: StudentCsvRowPreview[];
    totalRows: number;
    validCount: number;
    duplicateCount: number;
    existingDbCount: number;
    invalidCount: number;
  } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Delete State
  const [deletingStudent, setDeletingStudent] = useState<StudentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadStudents(targetPage = page, query = search) {
    setLoading(true);
    setError(null);
    const res = await getStudentsAction({ page: targetPage, pageSize: 12, search: query });
    if (!res.ok) {
      setError(res.message);
    } else {
      setStudents(res.data.students);
      setTotal(res.data.total);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadStudents(1, search);
  }, [search]);

  function handleOpenCreate() {
    setEditingStudent(null);
    setFormName("");
    setFormRollNumber("");
    setIsModalOpen(true);
  }

  function handleOpenEdit(student: StudentRecord) {
    setEditingStudent(student);
    setFormName(student.name);
    setFormRollNumber(student.roll_number);
    setIsModalOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingStudent) {
        const res = await updateStudentAction(editingStudent.id, {
          name: formName.trim(),
          roll_number: formRollNumber.trim(),
        });
        if (!res.ok) {
          setError(res.message);
        } else {
          setSuccess("Student details updated successfully.");
          setIsModalOpen(false);
          loadStudents(page, search);
        }
      } else {
        const res = await createStudentAction({
          name: formName.trim(),
          roll_number: formRollNumber.trim(),
        });
        if (!res.ok) {
          setError(res.message);
        } else {
          setSuccess("Student registered successfully.");
          setIsModalOpen(false);
          loadStudents(1, search);
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingStudent) return;
    setIsDeleting(true);
    const res = await deleteStudentAction(deletingStudent.id);
    if (!res.ok) {
      setError(res.message);
    } else {
      setSuccess("Student removed successfully.");
      setDeletingStudent(null);
      loadStudents(page, search);
    }
    setIsDeleting(false);
  }

  async function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      if (csvInputRef.current) csvInputRef.current.value = "";
      return;
    }

    setCsvFile(file);
    setCsvPreviewing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const res = await previewStudentsCsvAction(content);
      if (!res.ok) {
        setError(res.message);
        setCsvPreviewData(null);
      } else {
        setCsvPreviewData(res.data);
      }
      setCsvPreviewing(false);
    };
    reader.onerror = () => {
      setError("Unable to read the CSV file.");
      setCsvPreviewing(false);
    };
    reader.readAsText(file);
  }

  async function handleImportCsv() {
    if (!csvPreviewData) return;

    const validRows = csvPreviewData.previewRows
      .filter((r) => r.isValid)
      .map((r) => ({ name: r.name, roll_number: r.roll_number }));

    if (validRows.length === 0) {
      setError("No valid student rows to import.");
      return;
    }

    setCsvImporting(true);
    setError(null);

    const res = await importStudentsAction(validRows);
    if (!res.ok) {
      setError(res.message);
    } else {
      setSuccess(`Import Complete: ${res.data.added} added, ${res.data.skipped} skipped.`);
      setIsCsvModalOpen(false);
      setCsvPreviewData(null);
      setCsvFile(null);
      loadStudents(1, "");
    }
    setCsvImporting(false);
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">Student Enrollment Registry</h1>
          <p className="text-xs sm:text-sm text-[var(--mute)] font-medium mt-1">
            Manage student registrations, verify roll numbers, and bulk import students
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/templates/students_template.csv"
            download="students_template.csv"
            className="soft-button text-xs font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Template
          </a>
          <button
            onClick={() => {
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
            onClick={handleOpenCreate}
            className="soft-button-primary text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Student
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

      {/* Table Container (Soft UI) */}
      <div className="soft-card overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[var(--lo)] flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[var(--acc)]" />
            <h2 className="text-base font-bold text-[var(--ink)]">Enrolled Students</h2>
            <span
              className="text-xs px-3 py-1 rounded-full font-bold"
              style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
            >
              {total} Total
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[var(--mute)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name or roll..."
              className="soft-input w-full pl-10 pr-4 py-2 text-xs font-medium"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-16 text-center text-[var(--mute)]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
            <p className="text-xs font-bold">Loading student directory...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && students.length === 0 && (
          <div className="p-16 text-center text-[var(--mute)]">
            <Users className="w-12 h-12 mx-auto opacity-30 mb-3" />
            <p className="text-base font-bold text-[var(--ink)]">No students found</p>
            <p className="text-xs text-[var(--mute)] mt-1">
              {search
                ? "No registered students matched your search."
                : "No students registered yet. Add a student manually or upload a CSV."}
            </p>
          </div>
        )}

        {/* Desktop & Tablet Table */}
        {!loading && students.length > 0 && (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--lo)] text-xs font-bold text-[var(--mute)] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Roll Number</th>
                    <th className="px-6 py-4">Registered Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lo)]">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-[var(--lo)]/10 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--ink)]">{student.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="font-mono text-xs px-3 py-1 rounded-full font-bold inline-block"
                          style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                        >
                          {student.roll_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--mute)] font-medium">
                        {new Date(student.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(student)}
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--ink)] hover:text-[var(--acc)] active:shadow-[var(--press)] cursor-pointer"
                          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingStudent(student)}
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-red-500 hover:text-red-700 active:shadow-[var(--press)] cursor-pointer"
                          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden divide-y divide-[var(--lo)]">
              {students.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-[var(--ink)]">{student.name}</p>
                    <span
                      className="font-mono text-xs px-2.5 py-0.5 rounded-full font-bold inline-block"
                      style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                    >
                      {student.roll_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(student)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink)]"
                      style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingStudent(student)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-red-500"
                      style={{ background: "var(--bg)", boxShadow: "var(--raise-s)", border: 0 }}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-[var(--lo)] flex items-center justify-between text-xs text-[var(--mute)] font-medium">
            <span>
              Showing page <strong className="text-[var(--ink)]">{page}</strong> of{" "}
              <strong className="text-[var(--ink)]">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadStudents(page - 1, search)}
                disabled={page <= 1}
                className="w-8 h-8 rounded-full flex items-center justify-center soft-button disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => loadStudents(page + 1, search)}
                disabled={page >= totalPages}
                className="w-8 h-8 rounded-full flex items-center justify-center soft-button disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Add / Edit Modal (Soft UI) */}
      {isModalOpen && (
        <div className="soft-modal-overlay p-4">
          <div className="soft-modal-content max-w-md w-full p-6 sm:p-8 space-y-4">
            <h3 className="text-xl font-black text-[var(--ink)]">
              {editingStudent ? "Edit Student Details" : "Enroll New Student"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Enter the student&apos;s full name and their official unique roll number.
            </p>

            <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-800"
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
                  value={formRollNumber}
                  onChange={(e) => setFormRollNumber(e.target.value)}
                  placeholder="e.g. CS2024-001"
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none soft-inset text-slate-800 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 soft-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white soft-button-primary disabled:opacity-50"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingStudent ? (
                    "Save Changes"
                  ) : (
                    "Enroll Student"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal (Soft UI) */}
      {isCsvModalOpen && (
        <div className="soft-modal-overlay p-4">
          <div className="soft-modal-content max-w-2xl w-full p-6 sm:p-8 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--lo)]/30">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5 text-emerald-600" />
                <h3 className="text-xl font-black text-[var(--ink)]">Bulk Import Students</h3>
              </div>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-black"
              >
                &times;
              </button>
            </div>

            <div className="py-2 space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center soft-inset">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvSelect}
                  className="hidden"
                  id="csv-file-picker"
                />
                <label
                  htmlFor="csv-file-picker"
                  className="cursor-pointer inline-flex flex-col items-center justify-center"
                >
                  <FileCheck className="w-10 h-10 text-emerald-600 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    {csvFile ? csvFile.name : "Click to select CSV file"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Requires header columns: &quot;name&quot; and &quot;roll_number&quot;
                  </span>
                </label>
              </div>

              {csvPreviewing && (
                <div className="p-8 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                  <p className="text-xs font-bold">Verifying roll numbers against database...</p>
                </div>
              )}

              {csvPreviewData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs font-bold">
                    <div className="p-3 rounded-2xl soft-card-subtle">
                      <div className="text-lg font-black text-slate-900">{csvPreviewData.totalRows}</div>
                      Total Rows
                    </div>
                    <div className="p-3 rounded-2xl soft-card-subtle text-emerald-700">
                      <div className="text-lg font-black text-emerald-700">{csvPreviewData.validCount}</div>
                      Ready to Add
                    </div>
                    <div className="p-3 rounded-2xl soft-card-subtle text-amber-700">
                      <div className="text-lg font-black text-amber-700">
                        {csvPreviewData.existingDbCount + csvPreviewData.duplicateCount}
                      </div>
                      Duplicates
                    </div>
                    <div className="p-3 rounded-2xl soft-card-subtle text-red-700">
                      <div className="text-lg font-black text-red-700">{csvPreviewData.invalidCount}</div>
                      Invalid
                    </div>
                  </div>

                  <div className="rounded-2xl overflow-hidden soft-inset max-h-56 overflow-y-auto text-xs p-2">
                    <table className="w-full text-left">
                      <thead className="bg-slate-200/50 text-slate-600 sticky top-0 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Roll Number</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60">
                        {csvPreviewData.previewRows.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={row.isValid ? "hover:bg-white/40" : "bg-red-50/50"}
                          >
                            <td className="px-3 py-2 font-mono text-slate-500">#{row.rowIndex}</td>
                            <td className="px-3 py-2 font-bold text-slate-800">{row.name || "—"}</td>
                            <td className="px-3 py-2 font-mono">{row.roll_number || "—"}</td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {row.errorMessage}
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

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">
                {csvPreviewData ? `${csvPreviewData.validCount} to insert` : ""}
              </span>
              <div className="flex gap-3">
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
                  onClick={handleImportCsv}
                  disabled={!csvPreviewData || csvPreviewData.validCount === 0 || csvImporting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white soft-button-success disabled:opacity-50"
                >
                  {csvImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${csvPreviewData?.validCount ?? 0} Students`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Soft UI) */}
      {deletingStudent && (
        <div className="soft-modal-overlay p-4">
          <div className="soft-modal-content max-w-md w-full p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center soft-pill">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-[var(--ink)]">Remove Student</h3>
            <p className="text-xs text-[var(--mute)] leading-relaxed font-medium">
              Are you sure you want to remove{" "}
              <span className="font-bold text-[var(--ink)]">&quot;{deletingStudent.name}&quot;</span> (Roll:{" "}
              <span className="font-mono font-bold">{deletingStudent.roll_number}</span>)? Any quiz
              attempts associated with this student will also be removed.
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setDeletingStudent(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 soft-button"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white soft-button-danger disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Remove Student"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
