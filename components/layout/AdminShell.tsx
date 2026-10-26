"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export function AdminShell({ children, role, dataSource }: { children: React.ReactNode; role: "ADMIN" | "STAFF"; dataSource: "SUPABASE" | "SERVER MOCK" }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="admin-shell">
      <AdminHeader role={role} onMenu={() => setSidebarOpen((open) => !open)} />
      <AdminSidebar dataSource={dataSource} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <button className="admin-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}
      <main className="admin-main">{children}</main>
    </div>
  );
}
