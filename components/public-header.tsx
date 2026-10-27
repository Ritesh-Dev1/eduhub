"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

export function PublicHeader() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check initial theme preference
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

  return (
    <header className="sticky top-0 z-30 py-3.5 max-w-[1120px] w-full mx-auto px-5">
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg)",
          boxShadow: "var(--raise-s)",
          borderRadius: "999px",
          padding: "8px 10px 8px 22px",
        }}
      >
        <Link
          href="/"
          className="font-extrabold text-[19px] tracking-tight hover:opacity-90 transition-opacity"
          style={{ color: "var(--ink)", textDecoration: "none" }}
        >
          Eduhub
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/#subjects"
            className={`px-3 sm:px-4 py-2 rounded-full text-sm font-bold transition-all ${
              pathname === "/notes" || pathname === "/"
                ? "text-[var(--ink)] shadow-[var(--press)]"
                : "text-[var(--mute)] hover:text-[var(--ink)] hover:shadow-[var(--press)]"
            }`}
            style={{ textDecoration: "none" }}
          >
            Subjects
          </Link>

          <Link
            href="/#quizzes"
            className={`px-3 sm:px-4 py-2 rounded-full text-sm font-bold transition-all ${
              pathname.startsWith("/quizzes")
                ? "text-[var(--ink)] shadow-[var(--press)]"
                : "text-[var(--mute)] hover:text-[var(--ink)] hover:shadow-[var(--press)]"
            }`}
            style={{ textDecoration: "none" }}
          >
            Quizzes
          </Link>

          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-sm font-bold text-[var(--mute)] hover:text-[var(--ink)] hover:shadow-[var(--press)] transition-all"
            style={{ textDecoration: "none" }}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>

          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[17px] transition-transform active:shadow-[var(--press)] cursor-pointer"
            style={{
              background: "var(--bg)",
              boxShadow: "var(--raise-s)",
              color: "var(--ink)",
              border: 0,
            }}
            aria-label="Switch light or dark theme"
            title="Toggle theme"
          >
            ◐
          </button>
        </div>
      </nav>
    </header>
  );
}
