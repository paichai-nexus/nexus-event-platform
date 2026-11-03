"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { EVENT_EXTERNAL_FORMS } from "@/features/event/data/externalForms";
import { parseAudienceReservationRows, parseAudienceReservationText, type AudienceReservationImportRow } from "@/lib/audience-jury/parseAudienceReservationCsv";
import { AUDIENCE_JURY_DEPARTMENTS, AUDIENCE_JURY_PCU_RANGES, type AudienceJuryDepartment } from "@/types/audience-jury";
import type { AudienceReservation, AudienceReservationSummary } from "@/types/audience-reservation";

type ReservationPayload = { rows: AudienceReservation[]; summary: AudienceReservationSummary; imported?: number; duplicates?: number };

const emptySummary: AudienceReservationSummary = { total: 0, signed: 0, qrCheckedIn: 0, juryAccepted: 0 };

export default function AudienceReservationsPage() {
  const { state } = useEventOps();
  const [data, setData] = useState<ReservationPayload>({ rows: [], summary: emptySummary });
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<"ALL" | AudienceJuryDepartment>("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<AudienceReservationImportRow>({ department: AUDIENCE_JURY_DEPARTMENTS[0], name: "", studentNumber: "" });

  const load = useCallback(async () => {
    const params = new URLSearchParams({ eventId: state.eventId });
    const response = await fetch(`/api/audience-reservations?${params}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "예약자 명단을 불러오지 못했습니다.");
    setData(payload.data);
  }, [state.eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((caught) => setError(caught instanceof Error ? caught.message : "예약자 명단을 불러오지 못했습니다."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const importRows = async (rows: AudienceReservationImportRow[]) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/audience-reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, rows }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "명단을 등록하지 못했습니다.");
      setData(payload.data);
      setMessage(`${payload.data.imported}명 등록 · 중복 ${payload.data.duplicates}명 제외`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "명단을 등록하지 못했습니다.");
    } finally { setBusy(false); }
  };

  const uploadCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setMessage("");
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      if (!isXlsx && !/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error("XLSX, CSV UTF-8 또는 TSV 파일을 선택해주세요.");
      const parsed = isXlsx
        ? parseAudienceReservationRows(await (await import("read-excel-file/browser")).readSheet(file))
        : parseAudienceReservationText(await file.text());
      if (parsed.errors.length) throw new Error(`${parsed.errors.slice(0, 3).join(" / ")}${parsed.errors.length > 3 ? ` 외 ${parsed.errors.length - 3}건` : ""}`);
      if (!parsed.rows.length) throw new Error("등록 가능한 예약자가 없습니다.");
      await importRows(parsed.rows);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "파일을 읽지 못했습니다."); }
  };

  const addManual = async (event: FormEvent) => {
    event.preventDefault();
    await importRows([{ ...manual, name: manual.name.trim(), studentNumber: manual.studentNumber.trim().toUpperCase() }]);
    setManual((current) => ({ ...current, name: "", studentNumber: "" }));
  };

  const toggleSigned = async (row: AudienceReservation) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/audience-reservations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, id: row.id, paperSigned: !row.paperSignedAt }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "서명 상태를 바꾸지 못했습니다.");
      setData(payload.data);
      setMessage(`${row.name} 학생을 ${row.paperSignedAt ? "미참석" : "참석 서명 완료"} 상태로 변경했습니다.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "서명 상태를 바꾸지 못했습니다."); }
    finally { setBusy(false); }
  };

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.rows.filter((row) => (department === "ALL" || row.department === department)
      && (!normalized || `${row.name} ${row.studentNumber} ${row.pcuCode ?? ""}`.toLowerCase().includes(normalized)));
  }, [data.rows, department, query]);

  return <div className="admin-page audience-admin">
    <SectionLabel label="AUDIENCE JURY" title="예약·서명·청중평가단 관리" description="Google Form 예약 명단을 불러오고 종이 서명, 현장 QR 인증, 학과별 PCU 발급 상태를 관리합니다." />
    <OperationAlert level="WARNING">현재 리허설용 Mock 저장소입니다. Excel 원본은 CSV UTF-8로 저장해 불러오며, 서버 재시작 시 데이터가 초기화될 수 있습니다.</OperationAlert>
    <OperationAlert level="INFO">Google Form 응답은 자동 동기화되지 않습니다. 응답을 XLSX/CSV로 내려받아 아래에서 가져온 뒤 종이 서명과 현장 인증을 확인하세요.</OperationAlert>
    <section className="stat-grid stat-grid--4 audience-admin__stats">
      <StatCard label="예약 명단" value={data.summary.total} detail="명" icon="☷" />
      <StatCard label="종이 서명" value={data.summary.signed} detail="명" icon="✓" progress={data.summary.total ? data.summary.signed / data.summary.total * 100 : 0} />
      <StatCard label="1부 QR 출석" value={data.summary.qrCheckedIn} detail="명" icon="⌁" progress={data.summary.signed ? data.summary.qrCheckedIn / data.summary.signed * 100 : 0} />
      <StatCard label="PCU 발급" value={data.summary.juryAccepted} detail="/ 120명" accent icon="#" progress={data.summary.juryAccepted / 120 * 100} />
    </section>
    <div className="audience-admin__tools">
      <section className="admin-card audience-import-card">
        <PanelHeader label="ROSTER IMPORT" title="예약자 명단 가져오기" />
        <p>Excel 첫 행의 열 제목은 <b>학과, 학번, 이름</b>을 사용합니다. 기존 학번은 중복 등록되지 않습니다.</p>
        <a className="admin-button" href={EVENT_EXTERNAL_FORMS.audienceJuryReservation.url} target="_blank" rel="noreferrer">청중평가단 예약 폼 열기 ↗</a>
        <label className={`admin-button admin-button--primary audience-file-button ${busy ? "is-disabled" : ""}`}>
          XLSX / CSV 파일 선택<input type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values" onChange={uploadCsv} disabled={busy} />
        </label>
      </section>
      <form className="admin-card audience-manual-card" onSubmit={addManual}>
        <PanelHeader label="MANUAL ENTRY" title="예약자 1명 추가" />
        <div className="audience-manual-card__fields">
          <label className="admin-field">학과<select value={manual.department} onChange={(event) => setManual({ ...manual, department: event.target.value as AudienceJuryDepartment })}>{AUDIENCE_JURY_DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="admin-field">학번<input required minLength={5} maxLength={20} value={manual.studentNumber} onChange={(event) => setManual({ ...manual, studentNumber: event.target.value })} /></label>
          <label className="admin-field">이름<input required minLength={2} maxLength={30} value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} /></label>
          <button className="admin-button admin-button--primary" disabled={busy}>추가</button>
        </div>
      </form>
    </div>
    {error && <OperationAlert level="CRITICAL">{error}</OperationAlert>}
    {message && <p className="participant-feedback" role="status">{message}</p>}
    <section className="admin-card">
      <PanelHeader label="ATTENDANCE ROSTER" title="예약자 참석표" aside={<span className="mock-note">{visibleRows.length} PEOPLE</span>} />
      <div className="audience-admin__filters">
        <label className="search-field"><span className="sr-only">예약자 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·학번·PCU 검색" /><i>⌕</i></label>
        <select aria-label="학과 필터" value={department} onChange={(event) => setDepartment(event.target.value as "ALL" | AudienceJuryDepartment)}><option value="ALL">전체 학과</option>{AUDIENCE_JURY_DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      <DataTable label="청중평가단 예약자 명단"><thead><tr><th>학과 / PCU 범위</th><th>학번</th><th>이름</th><th>종이 서명</th><th>QR 출석</th><th>청중평가단 번호</th><th>관리</th></tr></thead><tbody>
        {visibleRows.map((row) => { const range = AUDIENCE_JURY_PCU_RANGES[row.department]; return <tr key={row.id}><td><strong>{row.department}</strong><small className="audience-range-copy">PCU{range.start}–PCU{range.end}</small></td><td>{row.studentNumber}</td><td><strong>{row.name}</strong></td><td><StatusBadge tone={row.paperSignedAt ? "success" : "neutral"}>{row.paperSignedAt ? "서명 완료" : "미서명"}</StatusBadge></td><td><StatusBadge tone={row.qrCheckedInAt ? "blue" : "neutral"}>{row.qrCheckedInAt ? "QR 완료" : "대기"}</StatusBadge></td><td><strong className="audience-pcu-code">{row.pcuCode ?? "미발급"}</strong></td><td><button type="button" className={`admin-button admin-button--compact ${row.paperSignedAt ? "" : "admin-button--primary"}`} disabled={busy || Boolean(row.qrCheckedInAt)} onClick={() => toggleSigned(row)}>{row.paperSignedAt ? "서명 취소" : "서명 확인"}</button></td></tr>; })}
        {!visibleRows.length && <tr><td colSpan={7} className="audience-empty">등록된 예약자가 없습니다. CSV 명단을 불러오거나 수동으로 추가하세요.</td></tr>}
      </tbody></DataTable>
    </section>
  </div>;
}
