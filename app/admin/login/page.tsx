"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Loader2, AlertCircle, Shield } from "lucide-react";
import Link from "next/link";
import { loginAdminAction } from "../actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark =
      document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme(isDark ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const result = await loginAdminAction({ email, password });
      if (!result.ok) {
        setErrorMessage(result.message);
      } else {
        router.push(redirectPath);
        router.refresh();
      }
    } catch {
      setErrorMessage("Something went wrong on our side. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md w-full soft-card p-6 sm:p-10 relative">
      {/* Top Bar inside card */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-xs font-bold text-[var(--mute)] hover:text-[var(--ink)] flex items-center gap-1 transition-colors"
          style={{ textDecoration: "none" }}
        >
          &larr; Public Site
        </Link>
        <button
          onClick={toggleTheme}
          type="button"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] cursor-pointer"
          style={{
            background: "var(--bg)",
            boxShadow: "var(--raise-s)",
            color: "var(--ink)",
            border: 0,
          }}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          ◐
        </button>
      </div>

      <div className="text-center mb-8">
        <div className="ico mx-auto mb-4">
          <Shield className="w-7 h-7 text-[var(--acc)]" />
        </div>
        <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight">
          Admin Portal
        </h1>
        <p className="text-xs text-[var(--mute)] font-medium mt-1">
          Sign in to access your administrative controls
        </p>
      </div>

      {errorMessage && (
        <div
          className="mb-6 p-4 rounded-2xl flex items-start gap-3"
          style={{
            background: "var(--bg)",
            boxShadow: "var(--press)",
            border: "1px solid #e05260",
          }}
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-500 font-bold leading-relaxed">
            {errorMessage}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            className="block text-xs font-bold uppercase tracking-wider text-[var(--mute)] mb-2"
            htmlFor="admin-email"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--mute)]">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@institution.edu"
              className="soft-input w-full pl-11 pr-4 py-3 text-sm font-medium"
            />
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-bold uppercase tracking-wider text-[var(--mute)] mb-2"
            htmlFor="admin-password"
          >
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--mute)]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="admin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="soft-input w-full pl-11 pr-4 py-3 text-sm font-medium"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="soft-button-primary w-full py-3.5 px-4 text-sm font-bold flex items-center justify-center disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In to Control Center"
          )}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--ink)] px-4 py-12">
      <Suspense
        fallback={
          <div className="p-12 text-center text-[var(--mute)]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
            <p className="text-sm font-bold">Loading admin portal...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
