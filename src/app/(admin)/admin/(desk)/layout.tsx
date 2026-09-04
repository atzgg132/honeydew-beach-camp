import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminPageSession } from "@/server/auth/admin-session";
import { AdminShell } from "@/features/admin/shell/AdminShell";

function deskNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/admin")) return "/admin";
  const path = raw.split("?")[0] ?? raw;
  if (path === "/admin/login" || path.startsWith("/admin/login/")) return "/admin";
  if (path === "/admin/accept" || path.startsWith("/admin/accept/")) return "/admin";
  return raw;
}

export default async function AdminDeskLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const next = deskNextPath(headerStore.get("x-admin-path"));
  const session = await getAdminPageSession();
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
