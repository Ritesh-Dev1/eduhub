import { getCurrentAdmin } from "@/lib/auth/admin";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let adminEmail = "";

  try {
    const admin = await getCurrentAdmin();
    adminEmail = admin.email;
  } catch {
    // If not authenticated, login page or middleware handles redirect
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col selection:bg-[var(--acc)] selection:text-white">
      <AdminNav adminEmail={adminEmail} />
      <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
