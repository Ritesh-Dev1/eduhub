"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  HelpCircle,
  Users,
  Activity,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { logoutAdminAction } from "./actions";

interface AdminNavProps {
  adminEmail: string;
}

export function AdminNav({ adminEmail }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  const navItems = [
    { label: "Notes", href: "/admin/notes", icon: FileText },
    { label: "Quizzes", href: "/admin/quizzes", icon: HelpCircle },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Live Monitor", href: "/admin/monitor", icon: Activity },
    { label: "Error Logs", href: "/admin/errors", icon: AlertTriangle },
  ];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutAdminAction();
      router.push("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 py-3.5 max-w-[1120px] w-full mx-auto px-4 sm:px-6">
      {/* Pill Navbar */}
      <nav className="admin-pill-nav">
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            href="/admin/notes"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 800,
              fontSize: "18px",
              color: "var(--ink)",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
          >
            <Shield style={{ width: "20px", height: "20px", color: "var(--acc)" }} />
            <span>Eduhub</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: "999px",
                boxShadow: "var(--press)",
                color: "var(--acc)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Admin
            </span>
          </Link>
        </div>

        {/* Desktop Links (Hidden on Mobile) */}
        <div className="admin-links-desktop">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-link-pill ${isActive ? "active" : ""}`}
              >
                <Icon style={{ width: "15px", height: "15px" }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Tools (Theme, Public Link, Logout, Hamburger) */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Public Portal Link */}
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Public Site"
            className="admin-link-pill"
            style={{ padding: "8px 12px" }}
          >
            <ExternalLink style={{ width: "14px", height: "14px" }} />
            <span className="hidden sm:inline">Public Site</span>
          </Link>

          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            type="button"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg)",
              boxShadow: "var(--raise-s)",
              color: "var(--ink)",
              border: 0,
              cursor: "pointer",
              fontSize: "16px",
            }}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            ◐
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            type="button"
            className="hidden sm:inline-flex admin-link-pill"
            style={{
              background: "var(--bg)",
              boxShadow: "var(--raise-s)",
              border: 0,
              cursor: "pointer",
              color: "var(--ink)",
            }}
            title={`Signed in as ${adminEmail}`}
          >
            <LogOut style={{ width: "14px", height: "14px", color: "#e05260" }} />
            <span>{loggingOut ? "..." : "Logout"}</span>
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
            className="admin-menu-btn"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg)",
              boxShadow: "var(--raise-s)",
              color: "var(--ink)",
              border: 0,
              cursor: "pointer",
            }}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X style={{ width: "18px", height: "18px" }} /> : <Menu style={{ width: "18px", height: "18px" }} />}
          </button>
        </div>
      </nav>

      {/* Mobile Horizontal Quick-Pill Switcher (Visible on mobile screens) */}
      <div className="admin-quick-bar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-link-pill ${isActive ? "active" : ""}`}
              style={{
                flexShrink: 0,
                boxShadow: isActive ? "var(--press)" : "var(--raise-s)",
                background: "var(--bg)",
              }}
            >
              <Icon style={{ width: "14px", height: "14px" }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Mobile Drawer Sheet */}
      {mobileMenuOpen && (
        <div
          className="soft-modal-overlay"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="soft-modal-content max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--lo)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield style={{ width: "20px", height: "20px", color: "var(--acc)" }} />
                <span style={{ fontWeight: 800, fontSize: "16px", color: "var(--ink)" }}>Admin Control</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                type="button"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg)",
                  boxShadow: "var(--raise-s)",
                  border: 0,
                  cursor: "pointer",
                  color: "var(--mute)",
                }}
              >
                <X style={{ width: "16px", height: "16px" }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`admin-link-pill ${isActive ? "active" : ""}`}
                    style={{
                      justifyContent: "flex-start",
                      padding: "10px 16px",
                      boxShadow: isActive ? "var(--press)" : "var(--raise-s)",
                      background: "var(--bg)",
                    }}
                  >
                    <Icon style={{ width: "16px", height: "16px", color: "var(--acc)" }} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div style={{ paddingTop: "12px", borderTop: "1px solid var(--lo)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="admin-link-pill"
                style={{
                  justifyContent: "flex-start",
                  padding: "10px 16px",
                  boxShadow: "var(--raise-s)",
                  background: "var(--bg)",
                }}
              >
                <ExternalLink style={{ width: "16px", height: "16px" }} />
                <span>Open Public Portal</span>
              </Link>

              <div style={{ padding: "12px", borderRadius: "14px", boxShadow: "var(--press)" }}>
                <p style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 800, color: "var(--mute)" }}>
                  Signed in as
                </p>
                <p style={{ fontWeight: 800, fontSize: "12px", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {adminEmail}
                </p>
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                type="button"
                className="soft-button-danger"
                style={{ width: "100%", padding: "10px 16px", cursor: "pointer" }}
              >
                <LogOut style={{ width: "16px", height: "16px" }} />
                <span>{loggingOut ? "Signing out..." : "Log Out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
