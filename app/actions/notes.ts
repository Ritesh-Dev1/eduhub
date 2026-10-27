"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { noteMetadataSchema, MAX_PDF_SIZE_BYTES } from "@/lib/validations/notes";
import { safeAction, type ActionResult } from "@/lib/errors/safe-action";
import { AppError } from "@/lib/errors/app-error";
import { revalidatePath } from "next/cache";

export interface NoteItem {
  id: string;
  title: string;
  subject: string;
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

// 1. Get notes with optional search & subject filter (Public & Admin)
export async function getNotesAction(
  searchQuery?: string,
  subjectFilter?: string
): Promise<ActionResult<{ notes: NoteItem[]; subjects: string[] }>> {
  return safeAction("getNotesAction", async () => {
    const supabase = await createClient();

    let query = supabase
      .from("notes")
      .select("id, title, subject, file_path, file_name, file_size, created_at")
      .order("created_at", { ascending: false });

    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.trim();
      query = query.or(`title.ilike.%${q}%,subject.ilike.%${q}%`);
    }

    if (subjectFilter && subjectFilter !== "ALL") {
      query = query.eq("subject", subjectFilter);
    }

    const { data: notes, error } = await query;
    if (error) {
      throw error;
    }

    // Get unique subjects list
    const { data: subjectsData } = await supabase
      .from("notes")
      .select("subject")
      .order("subject", { ascending: true });

    const subjects = Array.from(new Set(subjectsData?.map((s) => s.subject) || []));

    return {
      notes: (notes as NoteItem[]) || [],
      subjects,
    };
  });
}

// 2. Prepare Signed Upload URL for direct browser-to-storage upload (Admin only)
export async function getSignedUploadUrlAction(
  fileName: string,
  fileSize: number
): Promise<ActionResult<{ signedUrl: string; token: string; filePath: string }>> {
  return safeAction("getSignedUploadUrlAction", async () => {
    await getCurrentAdmin();

    if (!fileName.toLowerCase().endsWith(".pdf")) {
      throw new AppError("UPLOAD_FAILED", "Only PDF files are permitted. Please select a valid PDF file.");
    }

    if (fileSize > MAX_PDF_SIZE_BYTES) {
      throw new AppError("UPLOAD_FAILED", "File exceeds the 20 MB size limit. Please choose a smaller PDF.");
    }

    const adminClient = createAdminClient();
    const fileId = crypto.randomUUID();
    const filePath = `${fileId}.pdf`;

    const { data, error } = await adminClient.storage
      .from("notes")
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      throw new AppError("UPLOAD_FAILED", "We couldn't prepare the upload. Please check that it is a PDF under 20 MB and try again.");
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      filePath,
    };
  });
}

// 3. Confirm upload & create Note DB row with orphan cleanup rollback (Admin only)
export async function createNoteRecordAction(params: {
  title: string;
  subject: string;
  filePath: string;
  fileName: string;
  fileSize: number;
}): Promise<ActionResult<{ note: NoteItem }>> {
  return safeAction("createNoteRecordAction", async () => {
    const admin = await getCurrentAdmin();
    const validated = noteMetadataSchema.parse({
      title: params.title,
      subject: params.subject,
    });

    const adminClient = createAdminClient();

    // Verify file actually exists in storage bucket
    const { data: fileData, error: fileCheckError } = await adminClient.storage
      .from("notes")
      .list("", { search: params.filePath });

    if (fileCheckError || !fileData || fileData.length === 0) {
      throw new AppError("UPLOAD_FAILED", "We couldn't verify the uploaded file. Please try uploading again.");
    }

    // Insert note into database
    const { data: inserted, error: insertError } = await adminClient
      .from("notes")
      .insert({
        title: validated.title,
        subject: validated.subject,
        file_path: params.filePath,
        file_name: params.fileName,
        file_size: params.fileSize,
        uploaded_by: admin.id,
      })
      .select("id, title, subject, file_path, file_name, file_size, created_at")
      .single();

    if (insertError) {
      // Rollback: delete orphaned storage object so no orphaned files exist
      await adminClient.storage.from("notes").remove([params.filePath]);
      throw insertError;
    }

    revalidatePath("/notes");
    revalidatePath("/admin/notes");

    return { note: inserted as NoteItem };
  });
}

// 4. Server Action Fallback Upload (Admin only, bodySizeLimit handled in next.config.ts)
export async function uploadNoteServerAction(formData: FormData): Promise<ActionResult<{ note: NoteItem }>> {
  return safeAction("uploadNoteServerAction", async () => {
    const admin = await getCurrentAdmin();

    const title = formData.get("title") as string;
    const subject = formData.get("subject") as string;
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      throw new AppError("UPLOAD_FAILED", "No PDF file provided. Please select a PDF file.");
    }

    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      throw new AppError("UPLOAD_FAILED", "We couldn't upload your file. Please check that it is a PDF under 20 MB and try again.");
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      throw new AppError("UPLOAD_FAILED", "We couldn't upload your file. Please check that it is a PDF under 20 MB and try again.");
    }

    const validated = noteMetadataSchema.parse({ title, subject });

    const adminClient = createAdminClient();
    const fileId = crypto.randomUUID();
    const filePath = `${fileId}.pdf`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage
    const { error: storageError } = await adminClient.storage
      .from("notes")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (storageError) {
      throw new AppError("UPLOAD_FAILED", "We couldn't upload your file. Please check that it is a PDF under 20 MB and try again.");
    }

    // Insert into database
    const { data: inserted, error: insertError } = await adminClient
      .from("notes")
      .insert({
        title: validated.title,
        subject: validated.subject,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: admin.id,
      })
      .select("id, title, subject, file_path, file_name, file_size, created_at")
      .single();

    if (insertError) {
      // Rollback orphaned file
      await adminClient.storage.from("notes").remove([filePath]);
      throw insertError;
    }

    revalidatePath("/notes");
    revalidatePath("/admin/notes");

    return { note: inserted as NoteItem };
  });
}

// 5. Delete note (Admin only): removes both storage file and DB row
export async function deleteNoteAction(noteId: string): Promise<ActionResult<{ success: boolean }>> {
  return safeAction("deleteNoteAction", async () => {
    await getCurrentAdmin();

    const adminClient = createAdminClient();

    // Fetch file path first
    const { data: note, error: fetchError } = await adminClient
      .from("notes")
      .select("file_path")
      .eq("id", noteId)
      .maybeSingle();

    if (fetchError || !note) {
      throw new AppError("NOT_FOUND", "The requested note could not be found.");
    }

    // 1. Delete from storage
    if (note.file_path) {
      await adminClient.storage.from("notes").remove([note.file_path]);
    }

    // 2. Delete row from database
    const { error: deleteError } = await adminClient
      .from("notes")
      .delete()
      .eq("id", noteId);

    if (deleteError) {
      throw deleteError;
    }

    revalidatePath("/notes");
    revalidatePath("/admin/notes");

    return { success: true };
  });
}

// 6. Generate signed URL for Viewing / Downloading (Students & Admins, 3600 seconds)
export async function getNoteSignedUrlAction(
  noteId: string,
  download: boolean = false
): Promise<ActionResult<{ signedUrl: string; fileName: string }>> {
  return safeAction("getNoteSignedUrlAction", async () => {
    const adminClient = createAdminClient();

    const { data: note, error } = await adminClient
      .from("notes")
      .select("file_path, file_name")
      .eq("id", noteId)
      .maybeSingle();

    if (error || !note) {
      throw new AppError("NOT_FOUND", "The requested note could not be found.");
    }

    const { data: signedData, error: signedError } = await adminClient.storage
      .from("notes")
      .createSignedUrl(note.file_path, 3600, {
        download: download ? note.file_name : false,
      });

    if (signedError || !signedData?.signedUrl) {
      throw new AppError("UPLOAD_FAILED", "Could not generate download link. Please try again.");
    }

    return {
      signedUrl: signedData.signedUrl,
      fileName: note.file_name,
    };
  });
}
