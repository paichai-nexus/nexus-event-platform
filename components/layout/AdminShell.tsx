"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import type { RuntimeMode } from "@/lib/config/runtimePolicy";

export function AdminShell({ children, role, runtimeMode }: { children: React.ReactNode; role: "ADMIN" | "STAFF"; runtimeMode: RuntimeMode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="admin-shell">
      <AdminHeader role={role} onMenu={() => setSidebarOpen((open) => !open)} />
      <AdminSidebar runtimeMode={runtimeMode} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <button className="admin-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}
      <main className="admin-main">{children}</main>
    </div>
  );
}
