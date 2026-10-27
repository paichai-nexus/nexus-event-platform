import { redirect } from "next/navigation";
import { authorizeRoles } from "@/lib/auth/authorize";

export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const actor = await authorizeRoles(["JUDGE"]).catch(() => null);
  if (!actor) redirect("/login?next=/judge");
  return children;
}
