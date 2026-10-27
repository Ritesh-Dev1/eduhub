# Production Education & Examination Web Platform

A secure, production-grade Next.js (App Router, TypeScript) web application with Tailwind CSS, Supabase (Postgres, Auth, Storage, Realtime), `@supabase/ssr`, and Zod.

The system features two public portals (**Notes Repository** and **Assessment Center**) alongside a protected **Administrative Control Center** with live proctoring, session synchronization, and anti-cheat enforcement.

---

## Architecture & Permanent Rules Compliance

1. **Remote Data Only**: Zero dummy, mock, or hardcoded records. Every count, student, note, quiz question, attempt, and score originates from remote Supabase Postgres or Storage.
2. **Comprehensive States**: Every interface includes distinct loading spinners, empty placeholders, and friendly error alerts.
3. **Information Leakage Prevention**: Technical errors, SQL messages, 500 status codes, API tokens, and file system paths are never surfaced to users. All server actions and route handlers are wrapped with `safeAction`, logging real errors into `error_logs` and returning a user reference ID (e.g., `REF-A8F4D9`).
4. **Isolated Secrets**: Keys reside exclusively in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). The service role key is strictly isolated to server-side executions.
5. **Server Clock Authority**: All timing logic (countdown timers, exam durations, submission deadlines, session heartbeats) is enforced against the server/DB clock (`now()`), preventing client clock tampering.
6. **Strict Schema Validation**: All mutations are validated using Zod schemas with row-level error formatting for CSV uploads.
7. **Zero Answer Leakage**: The database questions table RLS restricts select access to admins. Student exam payloads strictly strip `correct_answer`. Grading is executed exclusively on the server upon submission.

---

## 1. Supabase Setup & Database Migration

### Step 1: Create Supabase Project
1. Log into your [Supabase Dashboard](https://supabase.com).
2. Create a new project (e.g., `edu-portal`).
3. Note your **Project URL**, **Anon Public Key**, and **Service Role Key** under **Project Settings > API**.

### Step 2: Run SQL Migrations
1. Navigate to the **SQL Editor** in your Supabase Dashboard.
2. Copy the entire contents of [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql).
3. Click **Run**. This will provision:
   - Tables: `admins`, `notes`, `quizzes`, `questions`, `students`, `attempts`, `answers`, `attempt_events`, `login_attempts`, `error_logs`.
   - Foreign keys, cascading constraints, and performance indexes.
   - Row Level Security (RLS) enabled on all 10 tables.
   - RLS policies protecting student and admin operations.
   - Storage bucket: `notes` (private, PDF only, 20 MB limit) with admin upload/delete policies.
   - Realtime publication on `quizzes`, `attempts`, and `attempt_events`.

### Step 3: Create the First Administrator
1. In your Supabase Dashboard, navigate to **Authentication > Users** and click **Add User > Create User**.
2. Enter an email (e.g. `admin@institution.edu`) and a strong password. Click **Create User**.
3. Copy the created user's **User UID** (UUID format).
4. Go back to the **SQL Editor** and run the following query to grant administrative privileges:
   ```sql
   INSERT INTO public.admins (user_id, email)
   VALUES ('YOUR_USER_UID_HERE', 'admin@institution.edu');
   ```

---

## 2. Local Development Setup

### Step 1: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your actual Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. CSV Templates (Headers Only)

The application provides downloadable CSV templates for bulk imports:
1. **Students Template** (`/templates/students_template.csv`):
   ```csv
   name,roll_number
   ```
2. **Quiz Questions Template** (`/templates/quiz_template.csv`):
   ```csv
   question,option_a,option_b,option_c,option_d,correct_answer,marks
   ```
   *Note: `correct_answer` must be one of `a`, `b`, `c`, or `d`.*

---

## 4. Production Deployment (Vercel)

1. Push your repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com), click **Add New > Project** and import the repository.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy the application. Production builds disable browser source maps, strip console statements, and apply HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`).

---

## 5. End-to-End Verification Checklist

| Test Scenario | Expected Outcome | Verified |
| :--- | :--- | :---: |
| **Notes Upload (Admin)** | Validates PDF under 20MB. Direct upload with progress bar. Record inserted with orphan cleanup on failure. | Yes |
| **Notes View/Download** | Generates temporary signed URLs (3600s TTL). No raw bucket URLs exposed. | Yes |
| **Notes Deletion** | Deletes both the database row and the storage object with confirm modal. | Yes |
| **Students CSV Import** | Flags row-level format errors, CSV duplicates, and database existing roll numbers. | Yes |
| **Admin Login Rate Limit** | Enforces max 5 failed attempts per 15 mins per IP + email. 6th attempt returns friendly 429. | Yes |
| **Countdown Sync** | "Approve & Start" sets `start_at = now() + 180s`. Refreshing the page does NOT reset timer. | Yes |
| **Anti-Cheat Lockouts** | Tab switch (`visibilitychange`), window blur, page reload, or duplicate tab immediately triggers blocked attempt. | Yes |
| **Server Grading** | Questions payload excludes `correct_answer`. Scoring executed exclusively on server. | Yes |
| **Proctor Re-exam** | Proctor can unblock with "Resume" (keeps answers) or "Restart" (clears answers). | Yes |
| **Results CSV Export** | Generates server-side CSV with name, roll, score, percentage, and security flags. | Yes |
| **Fault Injection** | Any network or database failure returns friendly message with reference ID. Zero SQL leaks. | Yes |
