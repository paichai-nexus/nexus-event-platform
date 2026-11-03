"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { PartAttendanceSnapshot } from "@/types/part-attendance";

type WorkflowCard = {
  step: string; title: string; time: string; status: string;
  tone: "success" | "blue" | "warning" | "neutral";
  value: string; detail: string; next: string; href: string; action: string;
  secondaryHref?: string; secondaryAction?: string;
};

export default function DashboardPage() {
  const { state } = useEventOps();
  const [attendance, setAttendance] = useState<PartAttendanceSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch("/api/part-attendance", { cache: "no-store" }).catch(() => null);
      const payload = response ? await response.json().catch(() => null) : null;
      if (active && response?.ok && payload?.ok) setAttendance(payload.data as PartAttendanceSnapshot);
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const submittedJudges = state.judgeProgress.filter((judge) => judge.completed === judge.total).length;
  const activeTeam = state.teams.find((team) => team.id === state.activeTeamId);
  const voteStatus = state.votingStatus === "OPEN" ? "진행 중" : state.votingStatus === "CLOSED" ? "마감" : "대기";
  const voteTone = state.votingStatus === "OPEN" ? "success" : state.votingStatus === "CLOSED" ? "neutral" : "warning";

  const cards = useMemo<WorkflowCard[]>(() => [
    {
      step: "01", title: "1부 출석", time: "행사 입장", status: attendance?.partOneCount ? "진행 중" : "대기", tone: attendance?.partOneCount ? "success" : "neutral",
      value: `${attendance?.partOneCount ?? 0}명`, detail: "QR 출석 · 학과별 PCU 선착순 발급", next: "스크린에 1부 QR을 띄우고 출석을 확인하세요.",
      href: "/admin/check-in", action: "1부 출석 관리", secondaryHref: "/admin/audience", secondaryAction: "PCU 명단 확인",
    },
    {
      step: "02", title: "2부 출석", time: "2부 시작 전", status: attendance?.partTwoCount ? "진행 중" : "대기", tone: attendance?.partTwoCount ? "success" : "neutral",
      value: `${attendance?.partTwoCount ?? 0}명`, detail: `1·2부 모두 출석 ${attendance?.bothCount ?? 0}명`, next: "2부 QR을 띄우고 럭키드로우 대상자를 확보하세요.",
      href: "/admin/check-in", action: "2부 출석 관리",
    },
    {
      step: "03", title: "청중평가", time: "15:00 / 16:00", status: voteStatus, tone: voteTone,
      value: `${state.voteCount}건`, detail: activeTeam ? `현재 부문: ${activeTeam.category === "BUSINESS_ANALYSIS" ? "기업분석" : "창업경진"}` : "기업분석 → 창업경진 순서",
      next: "발표 종료 후 해당 부문 투표를 시작하고, 제출 완료 뒤 마감하세요.", href: "/admin/voting", action: "투표 시작·마감",
    },
    {
      step: "04", title: "점수 집계", time: "투표 마감 후", status: submittedJudges === 3 ? "입력 완료" : "입력 대기", tone: submittedJudges === 3 ? "success" : "warning",
      value: `${submittedJudges} / 3명`, detail: "종이 심사표를 팀별·심사위원별 수기 입력", next: "심사 점수를 먼저 입력하고 청중 득표와 함께 검토하세요.",
      href: "/admin/judging", action: "심사 점수 입력", secondaryHref: "/admin/scoring", secondaryAction: "집계표 보기",
    },
    {
      step: "05", title: "럭키드로우", time: "1부 종료 / 3부", status: state.prizeHistory.length ? "진행 중" : "대기", tone: state.prizeHistory.length ? "blue" : "neutral",
      value: `${state.prizeHistory.length}명`, detail: "출석자 대상 · 중복 당첨 자동 차단", next: "먼저 대상자 명단을 봉인한 뒤 경품별 추첨을 실행하세요.",
      href: "/admin/prize", action: "경품 추첨 열기",
    },
    {
      step: "06", title: "시상식", time: "17:10~17:30", status: state.resultStatus === "FINALIZED" ? "확정" : "잠금", tone: state.resultStatus === "FINALIZED" ? "success" : "warning",
      value: state.resultStatus === "FINALIZED" ? "공개 가능" : "미공개", detail: "승인된 결과만 전광판에 공개", next: "점수 규정과 최종 결과 승인 후에만 공개하세요.",
      href: "/admin/ceremony", action: "시상식 제어", secondaryHref: "/admin/display", secondaryAction: "전광판 열기",
    },
  ], [activeTeam, attendance, state.prizeHistory.length, state.resultStatus, state.voteCount, submittedJudges, voteStatus, voteTone]);

  return <div className="admin-page admin-ops-home">
    <div className="admin-page__top admin-page__top--hero">
      <SectionLabel label="TODAY'S OPERATIONS" title="행사 운영 순서" description="2026. 11. 04. · 위에서 아래 순서대로 진행하세요" />
      <div><StatusBadge tone={state.snapshotError ? "danger" : "success"}>{state.snapshotError ? "서버 확인 필요" : "서버 연결됨"}</StatusBadge></div>
    </div>

    <OperationAlert level="INFO">청중평가는 PCU·학과·학번·이름 인증 후 해당 부문에서 순위 구분 없이 예상 1위 후보 2팀을 선택합니다. 심사위원 종이 점수는 관리자가 수기로 입력합니다.</OperationAlert>

    <section className="ops-workflow-grid" aria-label="행사 당일 주요 업무">
      {cards.map((card) => <article className="admin-card ops-workflow-card" key={card.step}>
        <header><span>{card.step}</span><div><small>{card.time}</small><h2>{card.title}</h2></div><StatusBadge tone={card.tone}>{card.status}</StatusBadge></header>
        <div className="ops-workflow-card__metric"><strong>{card.value}</strong><span>{card.detail}</span></div>
        <p><b>다음 작업</b>{card.next}</p>
        <footer><Link className="admin-button admin-button--primary" href={card.href}>{card.action}</Link>{card.secondaryHref && <Link className="admin-button" href={card.secondaryHref}>{card.secondaryAction}</Link>}</footer>
      </article>)}
    </section>

    <section className="admin-card ops-quick-links">
      <div><small>운영 보조</small><strong>필요할 때만 여세요</strong></div>
      <nav><Link href="/admin/teams">본선 12팀 확인</Link><Link href="/admin/display">현장 전광판</Link><Link href="/admin/results">결과·CSV</Link><Link href="/admin/settings">운영 설정</Link></nav>
    </section>
  </div>;
}
