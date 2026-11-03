"use client";

import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";

type OperationCard = {
  number: string;
  title: string;
  description: string;
  href: string;
  button: string;
  detail: string;
  secondary?: { href: string; label: string };
};

export default function DashboardPage() {
  const { state } = useEventOps();
  const judgeCompleted = state.judgeProgress.filter((judge) => judge.completed === judge.total).length;
  const dataReady = state.snapshotReady && !state.snapshotError;
  const serverLabel = state.snapshotError
    ? "서버 조회 실패"
    : state.snapshotReady
      ? "서버 연결됨"
      : "서버 조회 중";

  const cards: OperationCard[] = [
    {
      number: "01", title: "1부 출석", description: "QR 발급 · 출석 현황",
      href: "/admin/check-in", button: "출석 QR 관리",
      detail: "1부 입장 QR을 준비하고 출석을 확인합니다.",
    },
    {
      number: "02", title: "2부 출석", description: "QR 발급 · 출석 현황",
      href: "/admin/check-in", button: "출석 QR 관리",
      detail: "2부 출석 QR 운영 화면으로 이동합니다. 부별 숫자는 이 화면에서 추정하지 않습니다.",
    },
    {
      number: "03", title: "청중평가", description: "세션 1·2 투표 제어",
      href: "/admin/voting", button: "투표 시작·마감",
      detail: dataReady ? `기존 운영 상태: ${state.votingStatus}` : "상태를 확인 중입니다.",
    },
    {
      number: "04", title: "점수 집계", description: "수기 입력 · 순위 확정",
      href: "/admin/judging", button: "심사 입력·현황",
      detail: dataReady ? `심사 제출 현황 ${judgeCompleted}/${state.judgeProgress.length}` : "심사 데이터 조회 중",
      secondary: { href: "/admin/scoring", label: "점수 집계표" },
    },
    {
      number: "05", title: "럭키드로우", description: "추첨 · 당첨 이력",
      href: "/admin/prize", button: "경품 추첨 관리",
      detail: "1부 1차 · 3부 2차/3차 추첨 운영",
    },
    {
      number: "06", title: "시상식", description: "확정 결과 화면",
      href: "/admin/display", button: "전광판 제어",
      detail: dataReady && state.resultStatus === "FINALIZED" ? "최종 결과 확정 상태" : "미확정 결과는 공개 전에 반드시 확인",
      secondary: { href: "/admin/results", label: "결과 확인" },
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page__top admin-page__top--hero">
        <SectionLabel label="EVENT OPERATIONS" title="행사 운영 대시보드" description="2026. 11. 04. · 필요한 기능을 바로 선택하세요" />
        <StatusBadge tone={state.snapshotError ? "danger" : dataReady ? "success" : "warning"}>{serverLabel}</StatusBadge>
      </div>

      <section aria-label="행사 6대 운영 기능" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))", gap: 16 }}>
        {cards.map((card) => (
          <article className="admin-card" key={card.number} style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 214 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span aria-hidden="true" style={{ fontWeight: 800, opacity: 0.65, fontSize: 14 }}>{card.number}</span>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 20, fontWeight: 750, margin: 0 }}>{card.title}</h2>
                <p style={{ margin: "6px 0 0", opacity: 0.78 }}>{card.description}</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>{card.detail}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
              <Link className="admin-button admin-button--primary" href={card.href}>{card.button}</Link>
              {card.secondary && <Link className="admin-button" href={card.secondary.href}>{card.secondary.label}</Link>}
            </div>
          </article>
        ))}
      </section>
      <p style={{ marginTop: 14, fontSize: 13, opacity: 0.75 }}>
        안내: 이 화면은 기존 기능으로 이동하는 운영 홈입니다. 세션별 PCU 발급 인원과 1·2부 출석 인원은 연동 API가 검증될 때까지 임의로 표시하지 않습니다.
      </p>
    </div>
  );
}
