"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { EVENT_STATUS_LABELS, type EventMode, type EventStatus } from "@/types/event";

type PendingAction = { kind: "mode"; value: EventMode } | { kind: "status"; value: EventStatus } | { kind: "reset" } | null;

export default function SettingsPage() {
  const { state, setMode, setEventStatus, resetRehearsal } = useEventOps();
  const [pending, setPending] = useState<PendingAction>(null);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus>(state.status);
  const confirm = () => {
    if (pending?.kind === "mode") setMode(pending.value);
    if (pending?.kind === "status") setEventStatus(pending.value);
    if (pending?.kind === "reset") resetRehearsal();
    setPending(null);
  };
  const modalCopy = pending?.kind === "mode" ? ["Event Mode를 변경할까요?", `${pending.value} 모드로 전환하고 서버에 기록합니다.`, "Mode 변경"] : pending?.kind === "status" ? ["행사 상태를 변경할까요?", `${EVENT_STATUS_LABELS[pending.value]} 상태로 변경하고 서버에 기록합니다.`, "상태 변경"] : ["리허설 데이터를 초기화할까요?", "LIVE 데이터는 유지하고 리허설 운영 기록만 초기화합니다.", "초기화"];
  return (
    <div className="admin-page">
      <SectionLabel label="SETTINGS" title="운영 설정" description="행사 모드와 상태를 변경합니다. 모든 위험 작업은 확인이 필요합니다." />
      <section className="settings-grid">
        <article className="admin-card"><PanelHeader label="EVENT MODE" title="운영 모드" aside={<StatusBadge tone={state.mode === "LIVE" ? "success" : "warning"}>{state.mode}</StatusBadge>} /><p className="muted-copy">리허설 데이터셋은 LIVE로 직접 전환할 수 없습니다. 실제 운영은 별도 LIVE 행사 데이터셋에서 시작해야 합니다.</p><div className="mode-selector"><button type="button" className={state.mode === "REHEARSAL" ? "is-active" : ""} onClick={() => setPending({ kind: "mode", value: "REHEARSAL" })}><span>◇</span><strong>REHEARSAL</strong><small>리허설 데이터로 운영 연습</small></button><button type="button" className={state.mode === "LIVE" ? "is-active" : ""} disabled={state.mode === "REHEARSAL"} onClick={() => setPending({ kind: "mode", value: "LIVE" })}><span>●</span><strong>LIVE</strong><small>별도 운영 데이터셋 필요</small></button></div></article>
        <article className="admin-card"><PanelHeader label="EVENT STATUS" title="행사 상태" /><label className="admin-field">상태 선택<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as EventStatus)}>{Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value} disabled={value === "FINALIZED"}>{label} · {value}{value === "FINALIZED" ? " · 기준 확정 전 잠금" : ""}</option>)}</select></label><button className="admin-button admin-button--primary" type="button" disabled={selectedStatus === "FINALIZED"} onClick={() => setPending({ kind: "status", value: selectedStatus })}>상태 적용</button></article>
      </section>
      <section className="settings-grid settings-grid--bottom"><article className="danger-zone"><small>DANGER ZONE</small><h2>리허설 데이터 초기화</h2><p>리허설 Check-In·평가·심사·경품 기록만 초기화합니다. LIVE 데이터 삭제 기능은 없습니다.</p><button className="admin-button admin-button--danger" type="button" disabled={state.mode === "LIVE"} onClick={() => setPending({ kind: "reset" })}>Reset Rehearsal Data</button>{state.mode === "LIVE" && <span>LIVE Mode에서는 초기화할 수 없습니다.</span>}</article><article className="admin-card settings-log"><PanelHeader label="CHANGE LOG" title="설정 변경 안내" /><ul><li><span>01</span><p>모드 변경은 확인 모달과 관리자 권한을 거칩니다.</p></li><li><span>02</span><p>상태 변경은 서버와 Audit Log에 반영됩니다.</p></li><li><span>03</span><p>새로고침 후에도 서버 상태가 유지됩니다.</p></li></ul></article></section>
      <ConfirmModal open={pending !== null} title={modalCopy[0]} description={modalCopy[1]} confirmLabel={modalCopy[2]} danger={pending?.kind === "reset" || pending?.kind === "status" && pending.value === "FINALIZED"} onCancel={() => setPending(null)} onConfirm={confirm} />
    </div>
  );
}
