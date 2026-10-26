"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { downloadCsv } from "@/features/export/lib/downloadCsv";
import { calculateScoreRows } from "@/features/scoring/lib/calculateScores";
import { teamDisplayName } from "@/features/event/data/teamSlots";

const tabs = ["CHECK-IN", "AUDIENCE VOTE", "JUDGING", "FINAL RESULT", "PRIZE"] as const;
type Tab = typeof tabs[number];

export default function ResultsPage() {
  const { state } = useEventOps();
  const [tab, setTab] = useState<Tab>("CHECK-IN");
  const rows = useMemo<Array<Record<string, string | number | boolean>>>(() => {
    if (tab === "CHECK-IN") return state.checkIns.map((item) => ({ participantId: item.participantId, checkedInAt: item.time }));
    if (tab === "AUDIENCE VOTE") return state.teams.map((team) => ({ team: teamDisplayName(team), totalSubmissions: Math.floor(state.voteCount / state.teams.length) }));
    if (tab === "JUDGING") return state.judgeProgress.map((judge) => ({ judge: judge.id, completed: judge.completed, total: judge.total }));
    if (tab === "FINAL RESULT") return calculateScoreRows(state.scoreInputs).map((row) => ({ rank: row.tied ? `TIE ${row.rank}` : row.rank, team: row.teamName, professional: row.professional, audience: row.audience, finalScore: row.finalScore }));
    return state.prizeHistory.map((record) => ({ round: record.round, participantId: record.participantId, drawnAt: record.drawnAt }));
  }, [state, tab]);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="admin-page">
      <SectionLabel label="RESULTS / EXPORT" title="결과 / 내보내기" description="개인정보가 없는 Mock Preview를 CSV로 내보냅니다." />
      <div className="result-tabs" role="tablist" aria-label="결과 데이터 선택">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
      <section className="results-layout">
        <article className="admin-card"><PanelHeader label="DATA PREVIEW" title={tab} aside={<span className="mock-note">{rows.length} ROWS</span>} />{rows.length ? <DataTable label={`${tab} 미리보기`}><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{String(row[header])}</td>)}</tr>)}</tbody></DataTable> : <EmptyState message="아직 생성된 결과가 없습니다." />}</article>
        <aside className="admin-card export-panel"><PanelHeader label="EXPORT" title="CSV 다운로드" /><div className="export-file"><small>FILE NAME</small><strong>{tab.toLowerCase().replace(" ", "-")}.csv</strong></div><dl><div><dt>선택 범위</dt><dd>{tab}</dd></div><div><dt>데이터 수</dt><dd>{rows.length}건</dd></div><div><dt>파일 형식</dt><dd>CSV</dd></div></dl><p>현재 XLSX는 지원하지 않습니다. Mock 데이터만 다운로드됩니다.</p><button className="admin-button admin-button--primary admin-button--large" type="button" disabled={!rows.length} onClick={() => downloadCsv(`${tab.toLowerCase().replace(" ", "-")}.csv`, rows)}>CSV 다운로드</button></aside>
      </section>
    </div>
  );
}
