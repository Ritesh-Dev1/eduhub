-- ==============================================================================
-- 001_initial_schema.sql
-- Production schema for Next.js Education Web App
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES

-- Table: admins
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: notes
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'live', 'closed')),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    countdown_seconds INTEGER NOT NULL DEFAULT 180 CHECK (countdown_seconds >= 0),
    start_at TIMESTAMPTZ,
    show_score BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: questions (correct_answer is NEVER exposed to students)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
    marks NUMERIC NOT NULL DEFAULT 1 CHECK (marks > 0),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: students
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    roll_number TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: attempts
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'countdown', 'in_progress', 'submitted', 'blocked')),
    session_token TEXT NOT NULL,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    score NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_quiz_student UNIQUE (quiz_id, student_id)
);

-- Table: answers
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option TEXT NOT NULL CHECK (selected_option IN ('a', 'b', 'c', 'd')),
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

-- Table: attempt_events
CREATE TABLE IF NOT EXISTS public.attempt_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('blocked', 're_allowed')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: login_attempts (admin rate limiting)
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip TEXT NOT NULL,
    email TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL DEFAULT false
);

-- Table: error_logs
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_id TEXT NOT NULL UNIQUE,
    message TEXT NOT NULL,
    stack TEXT,
    route TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON public.notes(subject);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON public.quizzes(status);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_position ON public.questions(quiz_id, position);
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON public.students(roll_number);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_student ON public.attempts(quiz_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.attempts(status);
CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON public.answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_events_attempt_id ON public.attempt_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_email ON public.login_attempts(ip, email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_ref_id ON public.error_logs(ref_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);

-- 4. HELPER FUNCTIONS FOR SECURITY & RLS

-- Check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  );
$$;

-- 5. ENABLE ROW LEVEL SECURITY ON EVERY TABLE
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- admins: only existing admins can view admin records
DROP POLICY IF EXISTS "Admins can view admins list" ON public.admins;
CREATE POLICY "Admins can view admins list" ON public.admins
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- notes:
-- Public can view notes metadata
DROP POLICY IF EXISTS "Public can view notes" ON public.notes;
CREATE POLICY "Public can view notes" ON public.notes
    FOR SELECT TO public
    USING (true);

-- Only admins can insert notes
DROP POLICY IF EXISTS "Admins can insert notes" ON public.notes;
CREATE POLICY "Admins can insert notes" ON public.notes
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

-- Only admins can delete notes
DROP POLICY IF EXISTS "Admins can delete notes" ON public.notes;
CREATE POLICY "Admins can delete notes" ON public.notes
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- Only admins can update notes
DROP POLICY IF EXISTS "Admins can update notes" ON public.notes;
CREATE POLICY "Admins can update notes" ON public.notes
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- quizzes:
-- Public can read quizzes
DROP POLICY IF EXISTS "Public can view quizzes" ON public.quizzes;
CREATE POLICY "Public can view quizzes" ON public.quizzes
    FOR SELECT TO public
    USING (true);

-- Only admins can manage quizzes
DROP POLICY IF EXISTS "Admins can insert quizzes" ON public.quizzes;
CREATE POLICY "Admins can insert quizzes" ON public.quizzes
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update quizzes" ON public.quizzes;
CREATE POLICY "Admins can update quizzes" ON public.quizzes
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete quizzes" ON public.quizzes;
CREATE POLICY "Admins can delete quizzes" ON public.quizzes
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- questions:
-- IMPORTANT RULE: Students never read questions.correct_answer directly.
-- Direct table SELECT is restricted to admins only.
DROP POLICY IF EXISTS "Admins can select questions" ON public.questions;
CREATE POLICY "Admins can select questions" ON public.questions
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
CREATE POLICY "Admins can insert questions" ON public.questions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
CREATE POLICY "Admins can update questions" ON public.questions
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;
CREATE POLICY "Admins can delete questions" ON public.questions
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- students:
-- Admin full access
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
CREATE POLICY "Admins can manage students" ON public.students
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- attempts:
-- Admin full access
DROP POLICY IF EXISTS "Admins can view attempts" ON public.attempts;
CREATE POLICY "Admins can view attempts" ON public.attempts
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage attempts" ON public.attempts;
CREATE POLICY "Admins can manage attempts" ON public.attempts
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- answers:
-- Admin access only. Student mutations/reads are performed through secure server actions
DROP POLICY IF EXISTS "Admins can view answers" ON public.answers;
CREATE POLICY "Admins can view answers" ON public.answers
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- attempt_events:
-- Admin view only
DROP POLICY IF EXISTS "Admins can view attempt events" ON public.attempt_events;
CREATE POLICY "Admins can view attempt events" ON public.attempt_events
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- login_attempts:
-- Admin view only
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts" ON public.login_attempts
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- error_logs:
-- Admin view only
DROP POLICY IF EXISTS "Admins can view error logs" ON public.error_logs;
CREATE POLICY "Admins can view error logs" ON public.error_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- 7. STORAGE BUCKET: notes
-- Private bucket for PDF files only, max 20 MB (20971520 bytes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'notes',
    'notes',
    false,
    20971520,
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['application/pdf']::text[];

-- Storage Policies for notes bucket
DROP POLICY IF EXISTS "Admins can upload notes objects" ON storage.objects;
CREATE POLICY "Admins can upload notes objects" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'notes' AND
        public.is_admin()
    );

DROP POLICY IF EXISTS "Admins can delete notes objects" ON storage.objects;
CREATE POLICY "Admins can delete notes objects" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'notes' AND
        public.is_admin()
    );

DROP POLICY IF EXISTS "Admins can view notes objects" ON storage.objects;
CREATE POLICY "Admins can view notes objects" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'notes' AND
        public.is_admin()
    );

-- 8. REALTIME REPLICATION
-- Enable realtime publication on quizzes, attempts, and attempt_events
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attempts;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attempt_events;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;
