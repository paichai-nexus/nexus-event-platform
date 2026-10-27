"use client";

import { FormEvent, useEffect, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { PromoVideoInput } from "@/types/promo";

const EMPTY: PromoVideoInput = { videoUrl: "", thumbnailUrl: null, title: "", active: false };
export default function ContentPage() {
  const { state } = useEventOps();
  const [draft, setDraft] = useState<PromoVideoInput>(EMPTY);
  const [feedback, setFeedback] = useState("");
  useEffect(() => { const timer = window.setTimeout(async () => { const response = await fetch(`/api/promo-video?eventId=${state.eventId}`, { cache: "no-store" }); if (!response.ok) return; const payload = await response.json(); if (payload.data) setDraft(payload.data); }, 0); return () => window.clearTimeout(timer); }, [state.eventId]);
  const save = async (event: FormEvent) => { event.preventDefault(); const response = await fetch("/api/promo-video", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, eventId: state.eventId }) }); setFeedback(response.ok ? "홍보 영상 설정이 저장되었습니다." : "영상 URL과 썸네일 URL을 확인해주세요."); };
  return <div className="admin-page"><SectionLabel label="PROMO CONTENT" title="홍보 영상 관리" description="랜딩페이지에 표시할 세로형 숏폼 영상을 교체합니다." /><OperationAlert level="INFO">영상 제작과 파일 호스팅은 별도 콘텐츠 작업입니다. 이 화면은 재생 가능한 영상 URL과 썸네일을 연결합니다.</OperationAlert><form className="admin-card content-editor" onSubmit={save}><PanelHeader label="VERTICAL VIDEO" title="랜딩페이지 영상 설정" /><label className="admin-field">제목<input required value={draft.title} placeholder="영상 제목" onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="admin-field">영상 URL<input required type="url" value={draft.videoUrl} placeholder="https://…/video.mp4" onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })} /></label><label className="admin-field">썸네일 URL<input type="url" value={draft.thumbnailUrl ?? ""} placeholder="https://…/thumbnail.jpg" onChange={(event) => setDraft({ ...draft, thumbnailUrl: event.target.value || null })} /></label><label className="content-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>랜딩페이지에 영상 표시</span></label><button className="admin-button admin-button--primary" type="submit">영상 설정 저장</button><p className="participant-feedback" role="status">{feedback}</p></form></div>;
}
