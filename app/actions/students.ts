"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { studentSchema, type StudentInput } from "@/lib/validations/student";
import { safeAction, type ActionResult } from "@/lib/errors/safe-action";
import { AppError } from "@/lib/errors/app-error";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";

export interface StudentRecord {
  id: string;
  name: string;
  roll_number: string;
  created_at: string;
}

export interface StudentCsvRowPreview {
  rowIndex: number;
  name: string;
  roll_number: string;
  isValid: boolean;
  errorMessage?: string;
  isDuplicateInCsv: boolean;
  isExistingInDb: boolean;
}

// 1. List students with search and pagination
export async function getStudentsAction(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<
  ActionResult<{
    students: StudentRecord[];
    total: number;
    page: number;
    totalPages: number;
  }>
> {
  return safeAction("getStudentsAction", async () => {
    await getCurrentAdmin();
    const adminClient = createAdminClient();

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 15));
    const offset = (page - 1) * pageSize;

    let countQuery = adminClient.from("students").select("id", { count: "exact", head: true });
    let dataQuery = adminClient
      .from("students")
      .select("id, name, roll_number, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (params.search && params.search.trim() !== "") {
      const q = params.search.trim();
      countQuery = countQuery.or(`name.ilike.%${q}%,roll_number.ilike.%${q}%`);
      dataQuery = dataQuery.or(`name.ilike.%${q}%,roll_number.ilike.%${q}%`);
    }

    const [{ count, error: countError }, { data: students, error: dataError }] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    if (countError) throw countError;
    if (dataError) throw dataError;

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      students: (students as StudentRecord[]) || [],
      total,
      page,
      totalPages: totalPages === 0 ? 1 : totalPages,
    };
  });
}

// 2. Add single student
export async function createStudentAction(input: StudentInput): Promise<ActionResult<{ student: StudentRecord }>> {
  return safeAction("createStudentAction", async () => {
    await getCurrentAdmin();
    const validated = studentSchema.parse(input);
    const adminClient = createAdminClient();

    // Check roll number uniqueness
    const { data: existing } = await adminClient
      .from("students")
      .select("id")
      .eq("roll_number", validated.roll_number)
      .maybeSingle();

    if (existing) {
      throw new AppError("VALIDATION_ERROR", `A student with roll number "${validated.roll_number}" is already registered.`);
    }

    const { data: student, error } = await adminClient
      .from("students")
      .insert({
        name: validated.name,
        roll_number: validated.roll_number,
      })
      .select("id, name, roll_number, created_at")
      .single();

    if (error) throw error;

    revalidatePath("/admin/students");
    return { student: student as StudentRecord };
  });
}

// 3. Edit single student
export async function updateStudentAction(
  id: string,
  input: StudentInput
): Promise<ActionResult<{ student: StudentRecord }>> {
  return safeAction("updateStudentAction", async () => {
    await getCurrentAdmin();
    const validated = studentSchema.parse(input);
    const adminClient = createAdminClient();

    // Check collision with other students
    const { data: existing } = await adminClient
      .from("students")
      .select("id")
      .eq("roll_number", validated.roll_number)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      throw new AppError("VALIDATION_ERROR", `Another student is already using roll number "${validated.roll_number}".`);
    }

    const { data: updated, error } = await adminClient
      .from("students")
      .update({
        name: validated.name,
        roll_number: validated.roll_number,
      })
      .eq("id", id)
      .select("id, name, roll_number, created_at")
      .single();

    if (error) throw error;

    revalidatePath("/admin/students");
    return { student: updated as StudentRecord };
  });
}

// 4. Delete student
export async function deleteStudentAction(id: string): Promise<ActionResult<{ success: boolean }>> {
  return safeAction("deleteStudentAction", async () => {
    await getCurrentAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient.from("students").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/students");
    return { success: true };
  });
}

// 5. Preview & Validate Students CSV
export async function previewStudentsCsvAction(csvContent: string): Promise<
  ActionResult<{
    previewRows: StudentCsvRowPreview[];
    totalRows: number;
    validCount: number;
    duplicateCount: number;
    existingDbCount: number;
    invalidCount: number;
  }>
> {
  return safeAction("previewStudentsCsvAction", async () => {
    await getCurrentAdmin();

    const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
      header: true,
      skipEmptyLines: "greedy",
    });

    if (parsed.errors && parsed.errors.length > 0) {
      const firstErr = parsed.errors[0];
      throw new AppError("CSV_PARSE_ERROR", `CSV formatting issue on row ${firstErr.row ?? 1}: ${firstErr.message}`);
    }

    const rows = parsed.data;
    if (!rows || rows.length === 0) {
      throw new AppError("VALIDATION_ERROR", "The provided CSV file contains no data rows.");
    }

    // Verify expected header fields exist
    const sample = rows[0];
    const keys = Object.keys(sample).map((k) => k.trim().toLowerCase());
    if (!keys.includes("name") || !keys.includes("roll_number")) {
      throw new AppError(
        "CSV_PARSE_ERROR",
        'Invalid CSV headers. The file must contain "name" and "roll_number" columns.'
      );
    }

    const adminClient = createAdminClient();

    // Fetch existing roll numbers from database for comparison
    const allRollNumbers = rows
      .map((r) => (r.roll_number || r["Roll Number"] || r["roll number"] || "").trim())
      .filter(Boolean);

    const { data: dbMatches } = await adminClient
      .from("students")
      .select("roll_number")
      .in("roll_number", allRollNumbers);

    const existingDbSet = new Set((dbMatches || []).map((m) => m.roll_number.toLowerCase()));

    const seenInCsv = new Set<string>();
    const previewRows: StudentCsvRowPreview[] = [];

    let validCount = 0;
    let duplicateCount = 0;
    let existingDbCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // 1-indexed including header row

      const name = (row.name || row["Name"] || "").trim();
      const rollNumber = (row.roll_number || row["Roll Number"] || row["roll number"] || "").trim();

      const validation = studentSchema.safeParse({ name, roll_number: rollNumber });

      let isValid = true;
      let errorMessage: string | undefined;

      if (!validation.success) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: ${validation.error.issues[0]?.message || "Invalid row format"}`;
        invalidCount++;
      }

      const rollLower = rollNumber.toLowerCase();
      const isDuplicateInCsv = rollLower ? seenInCsv.has(rollLower) : false;
      if (isDuplicateInCsv && isValid) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: Duplicate roll number in CSV ("${rollNumber}")`;
        duplicateCount++;
      } else if (rollLower) {
        seenInCsv.add(rollLower);
      }

      const isExistingInDb = rollLower ? existingDbSet.has(rollLower) : false;
      if (isExistingInDb && isValid) {
        isValid = false;
        errorMessage = `Row ${rowIndex}: Roll number already exists in database ("${rollNumber}")`;
        existingDbCount++;
      }

      if (isValid) {
        validCount++;
      }

      previewRows.push({
        rowIndex,
        name,
        roll_number: rollNumber,
        isValid,
        errorMessage,
        isDuplicateInCsv,
        isExistingInDb,
      });
    }

    return {
      previewRows,
      totalRows: rows.length,
      validCount,
      duplicateCount,
      existingDbCount,
      invalidCount,
    };
  });
}

// 6. Bulk Insert Validated Students
export async function importStudentsAction(
  studentsToImport: { name: string; roll_number: string }[]
): Promise<ActionResult<{ added: number; skipped: number }>> {
  return safeAction("importStudentsAction", async () => {
    await getCurrentAdmin();

    if (!studentsToImport || studentsToImport.length === 0) {
      throw new AppError("VALIDATION_ERROR", "No valid students to import.");
    }

    const adminClient = createAdminClient();

    // Query DB to safeguard against race condition duplicates
    const rollNumbers = studentsToImport.map((s) => s.roll_number.trim());
    const { data: existingList } = await adminClient
      .from("students")
      .select("roll_number")
      .in("roll_number", rollNumbers);

    const existingSet = new Set((existingList || []).map((e) => e.roll_number.toLowerCase()));

    const uniqueNewStudents = studentsToImport.filter(
      (s) => !existingSet.has(s.roll_number.trim().toLowerCase())
    );

    const skipped = studentsToImport.length - uniqueNewStudents.length;

    if (uniqueNewStudents.length > 0) {
      const recordsToInsert = uniqueNewStudents.map((s) => ({
        name: s.name.trim(),
        roll_number: s.roll_number.trim(),
      }));

      // Insert in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
        const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await adminClient.from("students").insert(chunk);
        if (error) throw error;
      }
    }

    revalidatePath("/admin/students");

    return {
      added: uniqueNewStudents.length,
      skipped,
    };
  });
}
