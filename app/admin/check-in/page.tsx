"use client";

import { FormEvent, useMemo, useState } from "react";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { ExitQrPanel } from "@/features/check-in/components/ExitQrPanel";

const resultCopy = {
  IDLE: ["QR 또는 코드를 입력하세요", "입장 결과가 여기에 표시됩니다."],
  SCANNING: ["SCANNING", "QR 코드를 확인하고 있습니다."],
  SUCCESS: ["CHECK-IN COMPLETE", "입장이 정상 처리되었습니다."],
  ALREADY_CHECKED_IN: ["ALREADY CHECKED IN", "이미 입장 처리된 참가자입니다."],
  NOT_FOUND: ["TICKET NOT FOUND", "등록된 티켓을 찾지 못했습니다."],
  INACTIVE: ["INACTIVE TICKET", "비활성화된 참가자입니다."],
  INVALID_EVENT: ["INVALID EVENT", "현재 행사에서 사용할 수 없는 티켓입니다."],
  ERROR: ["CHECK-IN ERROR", "입장 처리 중 오류가 발생했습니다."],
} as const;

export default function CheckInPage() {
  const { state, checkIn } = useEventOps();
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const result = state.checkInResult;
  const tone = result.status === "SUCCESS" ? "success" : result.status === "ALREADY_CHECKED_IN" ? "warning" : result.status === "NOT_FOUND" || result.status === "ERROR" ? "danger" : "neutral";
  const visibleCheckIns = useMemo(() => state.checkIns.filter((record) => record.participantId.toLowerCase().includes(query.trim().toLowerCase())), [query, state.checkIns]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await checkIn(code);
    setCode("");
  };

  return (
    <div className="admin-page">
      <SectionLabel label="CHECK-IN" title="QR 입장 / 참가자 체크인" description="현장 입장 확인 및 서버 기반 중복 체크 방지" />
      <div className="checkin-layout">
        <section className="admin-card checkin-workspace">
          <PanelHeader label="QR CHECK-IN" title="입장 스캐너" aside={<StatusBadge tone="blue">{state.checkInCount}명 입장</StatusBadge>} />
          <div className="scanner-placeholder" aria-label="QR 스캐너 준비 영역"><div className="scan-frame"><i /><i /><i /><i /><span>⌗</span></div><strong>MANUAL CHECK-IN</strong><p>카메라 스캔 준비 전 · 수동 입력 사용 가능</p></div>
          <div className="scanner-tabs" role="tablist" aria-label="입장 방식"><button type="button" role="tab" aria-selected="false" disabled>QR 스캔 준비 중</button><button type="button" role="tab" aria-selected="true">수동 입력</button></div>
          <form className="manual-code" onSubmit={submit}>
            <label htmlFor="participant-code">PARTICIPANT CODE</label>
            <div><input id="participant-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="예: 0123" autoComplete="off" /><button className="admin-button admin-button--primary" type="submit" disabled={!code.trim()}>입장 확인</button></div>
          </form>
          <div className={`checkin-result checkin-result--${tone}`} role="status">
            <span>{result.status === "SUCCESS" ? "✓" : result.status === "ALREADY_CHECKED_IN" ? "!" : result.status === "NOT_FOUND" ? "×" : "⌁"}</span>
            <div><small>{result.status}</small><strong>{resultCopy[result.status][0]}</strong><p>{resultCopy[result.status][1]}</p>{result.participantId && <b>Participant {result.participantId}</b>}{result.time && <time>{result.time}</time>}{result.previousTime && <time>기존 입장 {result.previousTime}</time>}</div>
          </div>
        </section>
        <aside className="checkin-side">
          <ExitQrPanel />
          <section className="stat-grid stat-grid--2 checkin-stats">
            <StatCard label="전체 등록" value={state.registeredCount} detail="명" icon="◫" />
            <StatCard label="입장 완료" value={state.checkInCount} detail={`${Math.round((state.checkInCount / state.registeredCount) * 100)}%`} accent icon="✓" />
            <StatCard label="미입장" value={state.registeredCount - state.checkInCount} detail="명" icon="–" />
            <StatCard label="최근 기록" value={state.checkIns.length} detail="Server Snapshot" icon="↳" />
          </section>
          <section className="admin-card checkin-log">
            <PanelHeader label="RECENT CHECK-IN" title="최근 입장 로그" aside={<StatusBadge tone="success">SUCCESS</StatusBadge>} />
            <label className="search-field"><span className="sr-only">참가자 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="참가자 ID 검색" /><i aria-hidden="true">⌕</i></label>
            <div className="log-table__header"><span>시간</span><span>참가자 ID</span><span>상태</span></div>
            <ol className="recent-checkins">{visibleCheckIns.slice(0, 10).map((record) => <li key={`${record.participantId}-${record.time}`}><time>{record.time}</time><strong>{record.participantId}</strong><StatusBadge tone="success">완료</StatusBadge></li>)}</ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
