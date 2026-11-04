"use client";

import { useCallback, useEffect, useState } from "react";

type DiagnosticTeam = {
  teamId: string; teamName: string; category: string; presentationOrder: number;
  paperJudgeSubmissions: number; professionalRawScore600: number | null;
  audienceVoteCount: number; audienceEligibleCount: number; operationalCombinedRaw: number | null;
};
type DiagnosticReport = { ok: true; eventId: string; officialScoresAvailable: false; teams: DiagnosticTeam[] };

function isReport(value: unknown, eventId: string): value is DiagnosticReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<DiagnosticReport>;
  return report.ok === true && report.eventId === eventId && report.officialScoresAvailable === false && Array.isArray(report.teams);
}

export function ScoringDiagnosticsPanel({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/scoring/diagnostics?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store", credentials: "same-origin", signal });
      if (!response.ok) throw new Error(`집계 조회 실패 (HTTP ${response.status})`);
      const body: unknown = await response.json();
      if (!isReport(body, eventId)) throw new Error("집계 데이터 형식을 확인하지 못했습니다.");
      setReport(body); setError(null); setUpdatedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "집계 조회 실패");
    }
  }, [eventId]);

  useEffect(() => {
    const controller = new AbortController();
    const first = window.setTimeout(() => void load(controller.signal), 0);
    const timer = window.setInterval(() => { if (!document.hidden && navigator.onLine) void load(controller.signal); }, 3000);
    return () => { controller.abort(); window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  const groups = [{ key: "STARTUP", title: "창업 부문" }, { key: "BUSINESS_ANALYSIS", title: "기업분석 부문" }];
  const audienceSelections = report?.teams.reduce((sum, team) => sum + team.audienceVoteCount, 0) ?? 0;
  const completeTeams = report?.teams.filter((team) => team.professionalRawScore600 !== null).length ?? 0;

  return <section className="live-scoreboard" aria-label="실시간 점수 집계">
    <header className="live-scoreboard__header"><div><small>LIVE SCOREBOARD · 3초 자동 갱신</small><h2>청중평가 + 전문심사 집계</h2><p>종이 심사표 입력값과 청중의 예상 1위 후보 선택 수를 팀별로 보여줍니다.</p></div><button type="button" className="admin-button" onClick={() => void load()}>지금 새로고침</button></header>
    <div className="live-scoreboard__summary"><div><span>청중 선택 누계</span><strong>{audienceSelections}</strong><small>120명 × 부문별 2팀</small></div><div><span>전문심사 입력 완료</span><strong>{completeTeams} / {report?.teams.length ?? 12}</strong><small>팀별 심사위원 3명</small></div><div><span>최근 동기화</span><strong>{updatedAt || "연결 중"}</strong><small>{error ?? "서버 저장값 기준"}</small></div></div>
    {groups.map((group) => <section className="live-scoreboard__group" key={group.key}><h3>{group.title}</h3><div className="live-scoreboard__rows">
      {(report?.teams ?? []).filter((team) => team.category === group.key).map((team) => {
        const progress = Math.min(100, ((team.operationalCombinedRaw ?? team.audienceVoteCount) / 720) * 100);
        return <article key={team.teamId}><span className="live-scoreboard__order">{String(team.presentationOrder).padStart(2, "0")}</span><strong>{team.teamName}</strong><div className="live-scoreboard__bar"><i style={{ width: `${progress}%` }} /></div><dl><div><dt>청중</dt><dd>{team.audienceVoteCount}</dd></div><div><dt>심사</dt><dd>{team.professionalRawScore600 ?? `입력 ${team.paperJudgeSubmissions}/3`}</dd></div><div><dt>단순합계</dt><dd>{team.operationalCombinedRaw ?? "-"}</dd></div></dl></article>;
      })}
    </div></section>)}
    <footer>전문심사 원점수(600점)와 청중 선택 건수는 단위가 다릅니다. 이 화면은 현장 입력 확인용이며 승인 전 공식 환산점수·순위를 확정하지 않습니다.</footer>
  </section>;
}
