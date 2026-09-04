import { redirect } from "next/navigation";
import { getAdminPageSession } from "@/server/auth/admin-session";
import { AdminShell } from "@/features/admin/shell/AdminShell";

export default async function AdminDeskLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminPageSession();
  if (!session) redirect("/admin/login?next=/admin");
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
