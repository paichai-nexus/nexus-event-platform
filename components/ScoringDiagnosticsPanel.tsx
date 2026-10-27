"use client";

import { useEffect, useState } from "react";

type DiagnosticTeam = {
  teamId: string;
  teamName: string;
  assignedJudges: number;
  submittedJudges: number;
  completeJudgeSubmissions: number;
  judgeScorePreview100: number | null;
  audienceVoteCount: number;
  audienceEligibleCount: number;
  readyForPolicyReview: boolean;
};
type DiagnosticReport = {
  ok: true;
  eventId: string;
  status: "POLICY_APPROVAL_REQUIRED";
  officialScoresAvailable: false;
  reasons: string[];
  teams: DiagnosticTeam[];
};

function isDiagnosticReport(value: unknown, eventId: string): value is DiagnosticReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<DiagnosticReport>;
  return report.ok === true && report.eventId === eventId &&
    report.status === "POLICY_APPROVAL_REQUIRED" && report.officialScoresAvailable === false &&
    Array.isArray(report.reasons) && report.reasons.every((reason) => typeof reason === "string") &&
    Array.isArray(report.teams) && report.teams.every((team) =>
      team && typeof team.teamId === "string" && typeof team.teamName === "string" &&
      [team.assignedJudges, team.submittedJudges, team.completeJudgeSubmissions, team.audienceVoteCount, team.audienceEligibleCount].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0) &&
      (team.judgeScorePreview100 === null || (typeof team.judgeScorePreview100 === "number" && Number.isFinite(team.judgeScorePreview100))) &&
      typeof team.readyForPolicyReview === "boolean");
}

export function ScoringDiagnosticsPanel({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError(null);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      setError("조회할 행사 ID가 확인되지 않았습니다.");
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/scoring/diagnostics?eventId=${encodeURIComponent(eventId)}`, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "집계 조회 권한이 없습니다." : `집계 조회 실패 (HTTP ${response.status})`);
        const body: unknown = await response.json();
        if (!isDiagnosticReport(body, eventId)) throw new Error("집계 데이터 형식을 검증하지 못했습니다.");
        if (!controller.signal.aborted) setReport(body);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "집계 조회 중 오류가 발생했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [eventId, refreshKey]);

  return (
    <section className="admin-card" aria-label="읽기 전용 점수 집계 진단">
      <h2>실제 저장 데이터 집계 진단</h2>
      <p>관리자·운영진 전용 읽기 전용 조회입니다. 전문심사 점수는 참고용 100점 환산치이며, 청중 투표는 원시 투표 건수입니다. 공식 점수·순위가 아닙니다.</p>
      <button type="button" className="admin-button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>진단 새로고침</button>
      {loading && <p role="status">저장된 집계 정보를 읽는 중입니다.</p>}
      {error && <p role="alert">{error} 결과를 표시하지 않습니다.</p>}
      {report && <>
        <p role="status"><strong>공식 결과 확정 차단:</strong> 평가 기준 승인 대기</p>
        <ul>{report.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        {report.teams.length === 0 ? <p>현재 조회 가능한 팀이 없습니다.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <caption>DB 집계 현황 (공식 순위 아님)</caption>
              <thead><tr><th scope="col">팀</th><th scope="col">심사 제출</th><th scope="col">완성 제출</th><th scope="col">전문심사 참고치 /100</th><th scope="col">청중 투표 건수</th><th scope="col">투표 자격 인원</th><th scope="col">상태</th></tr></thead>
              <tbody>{report.teams.map((team) => <tr key={team.teamId}>
                <th scope="row">{team.teamName}</th>
                <td>{team.submittedJudges} / {team.assignedJudges}</td>
                <td>{team.completeJudgeSubmissions} / {team.assignedJudges}</td>
                <td>{team.judgeScorePreview100 === null ? "미산출" : team.judgeScorePreview100.toFixed(2)}</td>
                <td>{team.audienceVoteCount}</td><td>{team.audienceEligibleCount}</td>
                <td>{team.readyForPolicyReview ? "정책 검토 가능" : "제출 미완료"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </>}
    </section>
  );
}
