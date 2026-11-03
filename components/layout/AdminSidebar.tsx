"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RuntimeMode } from "@/lib/config/runtimePolicy";

const navigation = [
  ["▦", "운영 순서", "오늘 진행할 6단계", "/admin/dashboard"],
  ["①", "1·2부 출석", "QR·출석 인원", "/admin/check-in"],
  ["#", "PCU 관리", "예약·서명·번호표", "/admin/audience"],
  ["②", "청중평가", "부문별 시작·마감", "/admin/voting"],
  ["✎", "심사 점수 입력", "종이 점수 수기 입력", "/admin/judging"],
  ["▥", "점수 집계", "청중·전문심사 검토", "/admin/scoring"],
  ["③", "경품 추첨", "출석자 럭키드로우", "/admin/prize"],
  ["★", "시상식", "결과 공개 제어", "/admin/ceremony"],
  ["▣", "현장 전광판", "프로젝터 송출", "/admin/display"],
  ["◫", "본선 12팀", "팀 정보 확인", "/admin/teams"],
];

export function AdminSidebar({ open, onClose, runtimeMode }: { open: boolean; onClose: () => void; runtimeMode: RuntimeMode }) {
  const pathname = usePathname();
  return (
    <aside className={`admin-sidebar ${open ? "admin-sidebar--open" : ""}`} aria-label="관리자 메뉴">
      <div className="admin-sidebar__label">OPERATIONS MENU</div>
      <nav>
        {navigation.map(([icon, label, description, href]) => (
          <Link key={href} href={href} className={pathname === href ? "is-active" : ""} onClick={onClose}>
            <span aria-hidden="true">{icon}</span><span><strong>{label}</strong><small>{description}</small></span>
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar__foot">
        <span>{runtimeMode.toUpperCase()}</span>
        <small>{runtimeMode === "mock" ? "Explicit local mock" : "Supabase persistent storage"}</small>
      </div>
    </aside>
  );
}
