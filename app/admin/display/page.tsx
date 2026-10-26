"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import { DISPLAY_MODE_LABELS, EVENT_STATUS_LABELS } from "@/types/event";

export default function AdminDisplayPage() {
  const [snapshot, setSnapshot] = useState<PublicEventSnapshot | null>(null);
  const [connection, setConnection] = useState<"CONNECTING" | "ONLINE" | "OFFLINE">("CONNECTING");
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
