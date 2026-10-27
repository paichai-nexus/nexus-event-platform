import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { authorizeRoles } from "@/lib/auth/authorize";
import { requireRuntimeMode } from "@/lib/config/runtime";

export const metadata: Metadata = { title: "경영대학 학술제 운영 콘솔" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await authorizeRoles(["ADMIN", "STAFF"]).catch(() => null);
  if (!actor) redirect("/login?next=/admin/dashboard");
  const runtimeMode = requireRuntimeMode();
  return <AdminShell role={actor.role} runtimeMode={runtimeMode}>{children}</AdminShell>;
}
