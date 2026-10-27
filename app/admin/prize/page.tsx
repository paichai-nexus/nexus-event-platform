"use client";

import { FormEvent, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DataTable } from "@/components/ui/DataTable";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { PrizeDefinition, PrizeRecord } from "@/types/prize";

export default function PrizePage() {
  const { state, drawPrize, updatePrizeDefinition } = useEventOps();
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<PrizeDefinition | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [animationCode, setAnimationCode] = useState<string | null>(null);
  const [revealedWinner, setRevealedWinner] = useState<PrizeRecord | undefined>(undefined);
  const [speed, setSpeed] = useState<"FAST" | "NORMAL" | "SLOW">("NORMAL");
  const [presentation, setPresentation] = useState(false);
  const latest = state.prizeHistory.at(-1);
  const animateConfirmedWinner = async () => {
    setDrawing(true);
    setRevealedWinner(undefined);
    const confirmed = await drawPrize();
    if (!confirmed) {
      setDrawing(false);
      setFeedback("추첨 가능한 참가자가 없거나 서버 추첨에 실패했습니다.");
      return;
    }
    const steps = speed === "FAST" ? 14 : speed === "SLOW" ? 28 : 21;
    for (let step = 0; step < steps; step += 1) {
      setAnimationCode(`#${String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")}`);
      const progress = step / steps;
      const delay = (speed === "FAST" ? 35 : speed === "SLOW" ? 65 : 48) + Math.round(progress * progress * 210);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    setAnimationCode(confirmed.participantId);
    setRevealedWinner(confirmed);
    setDrawing(false);
  };
  const startDraw = () => state.prizeHistory.length ? setConfirm(true) : void animateConfirmedWinner();
  const togglePresentation = async () => {
    if (!presentation) await document.documentElement.requestFullscreen?.().catch(() => undefined);
    else await document.exitFullscreen?.().catch(() => undefined);
    setPresentation((current) => !current);
  };
  const savePrize = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    const accepted = await updatePrizeDefinition(draft);
    setFeedback(accepted ? `${draft.rank}등 경품 정보가 저장되었습니다.` : "저장하지 못했습니다. 확정 상태에는 상품명·수량·당첨자 수가 필요합니다.");
    if (accepted) setDraft(null);
    setSaving(false);
  };
  return (
    <div className="admin-page">
      <SectionLabel label="PRIZE DRAW" title="경품 추첨" description="체크인 완료 참가자를 서버에서 추첨하고 중복 당첨을 차단합니다." />
      <OperationAlert level="INFO">1등 경품은 기존 정책에 따라 별도 관리합니다. 아래 카탈로그는 2~12등만 관리하며 미확정 값을 임의로 채우지 않습니다.</OperationAlert>
      <section className="prize-layout">
        <div className={`prize-stage ${presentation ? "prize-stage--presentation" : ""} ${revealedWinner ? "is-revealed" : ""}`}>
          <small>PRIZE DRAW STAGE</small><p>참여 대상</p><strong>{state.checkInCount}<span>명</span></strong>
          {drawing ? <div className="prize-winner prize-winner--rolling"><small>REVEALING</small><b>Participant {animationCode}</b><time>서버 확정 결과 공개 중</time></div> : revealedWinner || latest ? <div className="prize-winner"><div className="confetti" aria-hidden="true">✦ ◆ ★ ✦ ◆ ★</div><small>WINNER</small><b>Participant {(revealedWinner ?? latest)?.participantId}</b><time>{(revealedWinner ?? latest)?.drawnAt}</time></div> : <div className="prize-winner prize-winner--empty"><small>READY</small><b>당첨자를 추첨하세요</b><time>SERVER-SIDE DRAW</time></div>}
          <div className="prize-stage__actions"><button className="admin-button admin-button--primary admin-button--large" type="button" disabled={drawing} onClick={startDraw}>{drawing ? "공개 중…" : latest ? "다음 추첨" : "추첨 시작"}</button><button className="admin-button admin-button--large" type="button" onClick={() => void togglePresentation()}>{presentation ? "전체 화면 종료" : "전체 화면 발표"}</button></div>
        </div>
        <aside className="prize-side">
          <section className="admin-card"><PanelHeader label="DRAW SETTINGS" title="추첨 설정" /><label className="admin-field">공개 속도<select value={speed} onChange={(event) => setSpeed(event.target.value as typeof speed)}><option value="FAST">빠르게</option><option value="NORMAL">보통</option><option value="SLOW">느리게</option></select></label><dl className="settings-summary"><div><dt>중복 당첨 정책</dt><dd>중복 금지 · 고정</dd></div><div><dt>서버 선확정</dt><dd>ON</dd></div><div><dt>총 추첨 횟수</dt><dd>{state.prizeHistory.length}</dd></div><div><dt>남은 대상</dt><dd>{state.checkInCount - state.prizeHistory.length}명</dd></div></dl></section>
          <section className="admin-card"><PanelHeader label="DRAW HISTORY" title="당첨 이력" />{state.prizeHistory.length ? <ol className="prize-history">{state.prizeHistory.map((record) => <li key={record.round}><span>{record.round}회차</span><strong>Participant {record.participantId}</strong><time>{record.drawnAt}</time></li>)}</ol> : <p className="muted-copy">아직 추첨 이력이 없습니다.</p>}</section>
        </aside>
      </section>
      {draft && <form className="admin-card prize-editor" onSubmit={savePrize}><PanelHeader label="PRIZE EDITOR" title={`${draft.rank}등 경품 수정`} aside={<button className="admin-button" type="button" onClick={() => setDraft(null)}>닫기</button>} /><div className="prize-editor__fields">
        <label className="admin-field">상품명<input value={draft.name ?? ""} placeholder="상품 확정 후 입력" onChange={(event) => setDraft({ ...draft, name: event.target.value || null })} /></label>
        <label className="admin-field">상품 이미지 URL<input type="url" value={draft.imageUrl ?? ""} placeholder="https://…" onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value || null })} /></label>
        <label className="admin-field">상품 수량<input type="number" min="1" value={draft.quantity ?? ""} placeholder="미확정" onChange={(event) => setDraft({ ...draft, quantity: event.target.value ? Number(event.target.value) : null })} /></label>
        <label className="admin-field">당첨자 수<input type="number" min="1" value={draft.winnerCount ?? ""} placeholder="미확정" onChange={(event) => setDraft({ ...draft, winnerCount: event.target.value ? Number(event.target.value) : null })} /></label>
        <label className="admin-field">상품 상태<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PrizeDefinition["status"] })}><option value="UNCONFIRMED">미확정</option><option value="CONFIRMED">확정</option></select></label>
        <label className="admin-field">추첨 상태<select value={draft.drawStatus} onChange={(event) => setDraft({ ...draft, drawStatus: event.target.value as PrizeDefinition["drawStatus"] })}><option value="READY">대기</option><option value="IN_PROGRESS">진행 중</option><option value="COMPLETED">완료</option></select></label>
      </div><button className="admin-button admin-button--primary" type="submit" disabled={saving}>{saving ? "저장 중…" : "경품 정보 저장"}</button></form>}
      <section className="admin-card"><PanelHeader label="PRIZE CATALOG" title="2~12등 경품 관리" aside={<span className="mock-note">{state.prizeCatalog.filter((prize) => prize.status === "CONFIRMED").length} / 11 CONFIRMED</span>} /><DataTable label="2등부터 12등 경품 목록"><thead><tr><th>등수</th><th>상품명</th><th>이미지</th><th>수량</th><th>당첨자 수</th><th>상품 상태</th><th>추첨 상태</th><th>관리</th></tr></thead><tbody>{state.prizeCatalog.map((prize) => <tr key={prize.id}><td><b className="table-order">{prize.rank}등</b></td><td>{prize.name ?? <span className="is-pending-copy">미확정</span>}</td><td>{prize.imageUrl ? "등록됨" : <span className="is-pending-copy">미등록</span>}</td><td>{prize.quantity ?? "—"}</td><td>{prize.winnerCount ?? "—"}</td><td><StatusBadge tone={prize.status === "CONFIRMED" ? "success" : "warning"}>{prize.status === "CONFIRMED" ? "확정" : "미확정"}</StatusBadge></td><td><StatusBadge tone={prize.drawStatus === "COMPLETED" ? "success" : prize.drawStatus === "IN_PROGRESS" ? "blue" : "neutral"}>{prize.drawStatus === "COMPLETED" ? "완료" : prize.drawStatus === "IN_PROGRESS" ? "진행 중" : "대기"}</StatusBadge></td><td><button className="admin-button admin-button--compact" type="button" onClick={() => { setDraft({ ...prize }); setFeedback(""); }}>수정</button></td></tr>)}</tbody></DataTable><p className="participant-feedback" role="status">{feedback}</p></section>
      <ConfirmModal open={confirm} title="다음 경품을 추첨할까요?" description="서버가 당첨자를 먼저 확정한 뒤 공개 애니메이션을 시작합니다. 이미 당첨된 참가자는 제외됩니다." confirmLabel="추첨 진행" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void animateConfirmedWinner(); }} />
    </div>
  );
}
