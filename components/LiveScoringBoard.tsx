"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ScoreTeam = {
  id: string; name: string; category: string; order: number;
  judgeSlots: Array<number | null>; submittedJudges: number; draftCount: number;
  judgeRaw: number; firstVotes: number; secondVotes: number; categoryBallots: number;
  audienceIllustration: number | null; judgeIllustration: number | null; illustrativeTotal: number | null;
};
type BoardData = {
  event: { name: string; mode: string; status: string; result_status: string };
  policyApproved: boolean; juryRegistered: number; totalBallots: number;
  totalSubmittedJudgeForms: number; teams: ScoreTeam[];
  updatedAt: string; illustrativeFormula: string;
};
const colors = ["#2dd4bf", "#facc15", "#f43f72", "#a78bfa", "#38bdf8", "#fb923c"];
const label = (category: string) => category === "STARTUP" ? "창업 부문" : "기업분석 부문";
const round = (value: number) => value.toFixed(2);

/** Deliberately READ ONLY: this panel cannot publish rankings or change votes. */
export function LiveScoringBoard({ eventId }: { eventId: string }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showStandings, setShowStandings] = useState(false);
  const [step, setStep] = useState(4);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!eventId) return;
    const response = await fetch(`/api/scoring/live?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store", credentials: "same-origin", signal });
    const body = await response.json() as { ok?: boolean; data?: BoardData; error?: string };
    if (!response.ok || !body.ok || !body.data) throw new Error(body.error ?? `집계 API 오류 (${response.status})`);
    if (!signal?.aborted) { setData(body.data); setError(""); setLoading(false); }
  }, [eventId]);
  useEffect(() => {
    const controller = new AbortController();
    const poll = () => { if (document.visibilityState === "visible") void refresh(controller.signal).catch((e: unknown) => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "조회 오류"); setLoading(false); } }); };
    const start = window.setTimeout(poll, 0);
    const interval = window.setInterval(poll, 5000);
    return () => { controller.abort(); window.clearTimeout(start); window.clearInterval(interval); };
  }, [refresh]);
  const categories = useMemo(() => {
    if (!data) return [];
    const ordered = ["STARTUP", "BUSINESS_ANALYSIS"];
    return ordered.filter((category) => data.teams.some((team) => team.category === category));
  }, [data]);
  const sortedWithin = (category: string) => (data?.teams ?? []).filter((team) => team.category === category).sort((a, b) => {
    if (a.illustrativeTotal === null && b.illustrativeTotal === null) return a.order - b.order;
    if (a.illustrativeTotal === null) return 1;
    if (b.illustrativeTotal === null) return -1;
    return b.illustrativeTotal - a.illustrativeTotal || a.order - b.order;
  });
  const hasAnyComplete = (data?.teams ?? []).some((team) => team.illustrativeTotal !== null);
  return <section aria-label="실제 DB 기반 평가 집계" style={{ border: "1px solid #1e4768", background: "linear-gradient(120deg,#061522,#0c2340)", color: "#e8f4ff", borderRadius: 12, padding: "clamp(18px,3vw,34px)", marginBlock: 24, fontFamily: "inherit" }}>
    <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <div><small style={{ color: "#38bdf8", letterSpacing: 2, fontWeight: 800 }}>LIVE DB · SCORING CONTROL</small><h2 style={{ fontSize: "clamp(24px,3vw,36px)", margin: "8px 0" }}>평가 단계별 집계</h2><p style={{ color: "#a9bfd4", margin: 0 }}>청중평가 20% · 전문심사 80% · 5초 자동 갱신</p></div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {[0, 1, 2, 3, 4].map((n) => <button key={n} type="button" onClick={() => setStep(n)} aria-pressed={step === n} style={{ padding: "10px 12px", background: step === n ? "#0c7aa5" : "#10314f", color: "white", border: "1px solid #34627d", borderRadius: 4, cursor: "pointer" }}>{n === 0 ? "시작" : n === 1 ? "청중" : n === 4 ? "전체" : `심사 ${n - 1}`}</button>)}
        <button type="button" onClick={() => setShowStandings(true)} disabled={!hasAnyComplete} style={{ padding: "10px 12px", background: "#146352", color: "white", border: 0, borderRadius: 4, opacity: hasAnyComplete ? 1 : .4 }}>참고 순위 보기</button>
      </div>
    </header>
    <p style={{ background: "#3a2817", borderLeft: "4px solid #fbbf24", color: "#fff0bf", padding: 12, marginBlock: 20, fontWeight: 600 }}>
      실제 DB 조회 · 순위/점수는 **임시 환산식의 참고값**입니다. 공식 정책 승인 및 심사 완료 전 발표 금지. 이 화면의 버튼은 DB를 수정하지 않습니다.
    </p>
    {loading && <p role="status">실제 점수 데이터 조회 중…</p>}
    {error && <p role="alert" style={{ color: "#fecaca" }}>집계 불러오기 실패: {error} · 마지막 데이터 유지</p>}
    {data && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBlock: 14 }}>
        {[
          ["청중평가단", `${data.juryRegistered} / 120명`],
          ["청중평가 투표", `${data.totalBallots}건`],
          ["심사위원 제출", `${data.totalSubmittedJudgeForms} / ${data.teams.length * 3}건`],
          ["평가 정책", data.policyApproved ? "승인됨 (환산식 검토 필수)" : "미승인 · 발표 차단"],
        ].map(([k, v]) => <div key={k} style={{ background: "#092b42", border: "1px solid #22516a", padding: 16 }}><small style={{ color: "#8eddeb" }}>{k}</small><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{v}</div></div>)}
      </div>
      <div style={{ fontSize: 12, color: "#b9ccdb", margin: "12px 0 22px" }}>조회 시각: {new Date(data.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · 화면 단계 {step}/4</div>
      {categories.map((category) => <div key={category} style={{ marginBottom: 22 }}>
        <h3 style={{ borderLeft: "4px solid #38bdf8", paddingLeft: 10, margin: "14px 0", fontSize: 16 }}>{label(category)} <small style={{ opacity: .7 }}>{sortedWithin(category).length}개 팀</small></h3>
        {sortedWithin(category).map((team, i) => {
          const audience = step >= 1 ? team.audienceIllustration ?? 0 : 0;
          const judges = team.judgeSlots.reduce<number>((sum, score, index) => sum + (step >= index + 2 && score !== null ? score / 600 * 80 : 0), 0);
          const visible = audience + judges;
          return <div key={team.id} style={{ background: i % 2 ? "#071d30" : "#092740", border: "1px solid #1a4966", display: "grid", gridTemplateColumns: "minmax(110px,1.2fr) minmax(160px,5fr) auto", alignItems: "center", padding: "12px 10px", gap: 12, marginBottom: 4 }}>
            <div><small style={{ color: "#82a7c2" }}>{String(team.order).padStart(2, "0")}</small><div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>{team.name}</div></div>
            <div>
              <div style={{ height: 17, background: "#1c4057", borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, Math.max(0, visible))}%`, background: colors[i % colors.length], transition: "width .45s ease", borderRadius: 999 }} /></div>
              <div style={{ fontSize: 11, color: "#bed3df", marginTop: 6 }}>청중 1순위 {team.firstVotes} · 2순위 {team.secondVotes} | 심사 {team.submittedJudges}/3 완료</div>
              <div style={{ fontSize: 11, color: "#78c9f5", marginTop: 3 }}>청중 {team.audienceIllustration === null ? "미투표" : round(team.audienceIllustration)} /20 · 심사 {team.judgeSlots.map((x) => x === null ? "—" : x).join(" / ")} (각 200점)</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 74 }}><strong style={{ fontSize: 21 }}>{step === 4 && team.illustrativeTotal === null ? "—" : round(visible)}</strong><div style={{ color: "#97b4c7", fontSize: 10 }}>/ 100 참고점</div></div>
          </div>;
        })}
      </div>)}
      <p style={{ fontSize: 12, color: "#9cb7c9" }}>참고 계산: {data.illustrativeFormula} 카테고리별 심사자료 완료 전에는 점수·순위가 표시되지 않습니다. 점수 공개 승인은 별도 운영 절차입니다.</p>
    </>}
    {showStandings && data && <div role="dialog" aria-modal="true" aria-label="참고 순위" style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,9,18,.93)", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ background: "linear-gradient(#0b2744,#06182b)", border: "1px solid #447994", color: "#fff", width: "min(980px,100%)", maxHeight: "90vh", overflowY: "auto", padding: "clamp(16px,3vw,36px)" }}>
        <header style={{ textAlign: "center", marginBottom: 20 }}><small style={{ color: "#4cd1e9", letterSpacing: 2 }}>LIVE DB · UNOFFICIAL PREVIEW</small><h2 style={{ fontSize: "clamp(26px,4vw,45px)", margin: "12px 0" }}>참고 순위 미리보기</h2><p style={{ color: "#ffce7c" }}>공식 순위 아님 · 승인된 환산식 적용 전 발표 금지</p></header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
          {categories.map((category) => <section key={category} style={{ background: "#062039", padding: 14, border: "1px solid #2d5875" }}><h3 style={{ textAlign: "center" }}>{label(category)}</h3>{sortedWithin(category).map((team, index) => <div key={team.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 8px", borderBottom: "1px solid #28506b", background: index < 3 ? "#123651" : undefined }}><span>{team.illustrativeTotal === null ? "—" : `${index + 1}위`} · <strong>{team.name}</strong></span><b>{team.illustrativeTotal === null ? "미집계" : `${round(team.illustrativeTotal)} /100`}</b></div>)}</section>)}
        </div>
        <button type="button" onClick={() => setShowStandings(false)} style={{ display: "block", margin: "22px auto 0", padding: "12px 30px", color: "white", background: "#126b90", border: 0, cursor: "pointer" }}>닫기</button>
      </div>
    </div>}
  </section>;
}
