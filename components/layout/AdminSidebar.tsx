"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RuntimeMode } from "@/lib/config/runtimePolicy";

const navigation = [
  ["▦", "Dashboard", "운영 현황", "/admin/dashboard"],
  ["⌁", "QR 입장", "참가자 체크인", "/admin/check-in"],
  ["◫", "행사 / 팀 관리", "발표팀 현황", "/admin/teams"],
  ["◎", "청중평가", "실시간 투표 관리", "/admin/voting"],
  ["✎", "심사", "심사위원 제출", "/admin/judging"],
  ["▥", "점수 집계", "80/20 결과", "/admin/scoring"],
  ["✦", "경품 추첨", "당첨자 추첨", "/admin/prize"],
  ["★", "응원 미션", "참여 승인·점수", "/admin/missions"],
  ["▶", "홍보 콘텐츠", "세로형 영상 관리", "/admin/content"],
  ["⇩", "결과 / Export", "CSV 내보내기", "/admin/results"],
  ["▣", "현장 전광판", "읽기 전용 송출", "/admin/display"],
  ["◇", "QA / 리허설", "상태 시뮬레이션", "/admin/qa"],
  ["⚙", "설정", "행사 운영 모드", "/admin/settings"],
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
