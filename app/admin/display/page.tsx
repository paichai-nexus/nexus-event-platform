"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import { DISPLAY_MODE_LABELS, EVENT_STATUS_LABELS } from "@/types/event";
import type { ResultShowDeck } from "@/types/result-show";

export default function AdminDisplayPage() {
  const [snapshot, setSnapshot] = useState<PublicEventSnapshot | null>(null);
  const [connection, setConnection] = useState<"CONNECTING" | "ONLINE" | "OFFLINE">("CONNECTING");
  const [resultShow, setResultShow] = useState<ResultShowDeck | null>(null);
  const versionRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/event/public-snapshot", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("snapshot failed");
      const payload = await response.json() as { data: PublicEventSnapshot };
      if (payload.data.version >= versionRef.current) {
        versionRef.current = payload.data.version;
        setSnapshot(payload.data);
      }
      if (payload.data.event.displayMode === "RESULT_SHOW") {
        const showResponse = await fetch("/api/result-show/public", { cache: "no-store", signal: controller.signal });
        const showPayload = await showResponse.json() as { data: ResultShowDeck | null };
        if (!showResponse.ok || !showPayload.data) throw new Error("approved result show missing");
        setResultShow(showPayload.data);
      }
      setConnection("ONLINE");
    } catch {
      setConnection("OFFLINE");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [refresh]);

  const enterFullscreen = () => document.documentElement.requestFullscreen?.();
  const mode = snapshot?.event.displayMode ?? "HOLDING";

  return (
    <main className={`event-display event-display--${mode.toLowerCase()}`}>
      <header className="event-display__header">
        <div><small>PAEJAE UNIVERSITY COLLEGE OF BUSINESS</small><strong>제24회 경영대학 학술제</strong></div>
        <div className="event-display__status"><span className={`display-connection display-connection--${connection.toLowerCase()}`}>{connection}</span><button type="button" onClick={enterFullscreen}>전체 화면</button></div>
      </header>
      {!snapshot ? <section className="event-display__center"><small>CONTROL SIGNAL</small><h1>운영 서버 연결 중</h1></section> : (
        <section className="event-display__center">
          <small>{DISPLAY_MODE_LABELS[mode]} · {EVENT_STATUS_LABELS[snapshot.event.status]}</small>
          {mode === "SPOTLIGHT" && snapshot.activeTeam ? <>
            <span className="event-display__number">{String(snapshot.activeTeam.order).padStart(2, "0")}</span>
            <h1>{snapshot.activeTeam.name}</h1>
            <p>{snapshot.activeTeam.topic ?? "발표 주제 준비 중"}</p>
            <b>{snapshot.activeTeam.category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</b>
            <dl className="event-display__team-profile">
              <div><dt>소속학과</dt><dd>{snapshot.activeTeam.department ?? "최종 명단 확인 예정"}</dd></div>
              <div><dt>팀원</dt><dd>{[snapshot.activeTeam.leaderName, ...snapshot.activeTeam.memberNames].filter(Boolean).join(", ") || "최종 명단 확인 예정"}</dd></div>
              <div><dt>지도교수</dt><dd>{snapshot.activeTeam.advisorName ? `${snapshot.activeTeam.advisorName} 교수님` : "최종 명단 확인 예정"}</dd></div>
            </dl>
          </> : null}
          {mode === "VOTE_PROGRESS" ? <>
            <span className="event-display__pulse" aria-hidden="true" />
            <h1>청중평가 {snapshot.event.votingStatus === "OPEN" ? "진행 중" : snapshot.event.votingStatus === "CLOSED" ? "마감" : "준비"}</h1>
            <p>{snapshot.activeTeam?.name ?? "다음 발표를 기다려주세요."}</p>
          </> : null}
          {mode === "AWARD_REVEAL" ? <>
            <span className="event-display__number">{snapshot.event.revealStep}</span>
            <h1>수상 결과 공개</h1>
            <p>운영자의 공개 신호를 기다려주세요.</p>
          </> : null}
          {mode === "RESULT_SHOW" && resultShow && resultShow.currentScene === "REVIEW" ? <>
            <small>JUDGES&apos; REVIEW · APPROVED SHOW</small>
            <h1>심사평</h1>
            <p className="event-display__review">{resultShow.judgeComment}</p>
            <b>관리자 승인 자료</b>
          </> : null}
          {mode === "RESULT_SHOW" && resultShow && resultShow.currentScene === "RESULT" ? <>
            <small>OFFICIAL CEREMONY SHOW · APPROVED</small>
            <h1>심사 결과</h1>
            <div className="event-display__award-list">{resultShow.awards.map((award) => <article key={`${award.title}-${award.teamName}`}><small>{award.title}</small><strong>{award.teamName}</strong><span>{award.detail}</span></article>)}</div>
          </> : null}
          {mode === "RESULT_SHOW" && resultShow?.currentScene === "BEST_REVIEWER" && resultShow.bestReviewer ? <>
            <small>BEST REVIEWER AWARD · APPROVED</small>
            <h1>베스트 리뷰어상</h1>
            <div className="event-display__best-reviewer"><span>{resultShow.bestReviewer.department}</span><strong>{resultShow.bestReviewer.name}</strong><p>“{resultShow.bestReviewer.reviewExcerpt}”</p><small>{resultShow.bestReviewer.participantCode.replace(/^(.{3}).+(.{2})$/, "$1•••$2")}</small></div>
          </> : null}
          {mode === "HOLDING" ? <>
            <span className="event-display__mark">✦</span>
            <h1>잠시만 기다려주세요</h1>
            <p>다음 순서를 준비하고 있습니다.</p>
          </> : null}
        </section>
      )}
      <footer className="event-display__footer"><span>2026. 11. 04. WED</span><span>배재대학교 21세기관</span><span>v{snapshot?.version ?? 0}</span></footer>
    </main>
  );
}
