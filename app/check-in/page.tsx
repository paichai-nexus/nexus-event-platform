"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AudienceAttendanceState } from "@/types/attendance";

export default function AudienceCheckInPage() {
  const [attendance, setAttendance] = useState<AudienceAttendanceState | null>(null);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState("QR 입장을 확인하고 있습니다.");
  const started = useRef(false);

  const request = useCallback(async (method: "GET" | "POST" | "DELETE", exitPass?: string) => {
    const response = await fetch("/api/attendance", {
      method,
      cache: "no-store",
      headers: exitPass ? { "Content-Type": "application/json" } : undefined,
      body: exitPass ? JSON.stringify({ exitPass }) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "입장 상태를 처리하지 못했습니다.");
    return payload.data as AudienceAttendanceState;
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const enterFromQr = async () => {
      try {
        const exitPass = new URLSearchParams(window.location.search).get("exitPass");
        const current = await request("GET");
        setAttendance(current);
        if (exitPass) {
          const next = current.active ? await request("DELETE", exitPass) : current;
          setAttendance(next);
          setMessage(current.active ? "출구 QR이 확인되어 퇴장이 완료되었습니다." : "이미 퇴장 처리되어 있습니다.");
          return;
        }
        const next = current.active || current.known ? current : await request("POST");
        setAttendance(next);
        setMessage(current.active ? "입장 중입니다. 퇴장할 때는 출구 전용 QR을 스캔해주세요." : current.known ? "퇴장 상태입니다. 다시 입장하려면 아래 버튼을 눌러주세요." : "입장이 완료되었습니다.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "입장 상태를 처리하지 못했습니다.");
      } finally {
        setPending(false);
      }
    };
    void enterFromQr();
  }, [request]);

  const enterAgain = async () => {
    setPending(true);
    setMessage("입장 처리 중입니다.");
    try {
      const next = await request("POST");
      setAttendance(next);
      setMessage("입장이 완료되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "입장 처리에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const enteredTime = attendance?.enteredAt
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(attendance.enteredAt))
    : null;

  return (
    <main className="audience-entry-page">
      <section className={`audience-entry-card ${attendance?.active ? "is-active" : ""}`}>
        <Link href="/" className="audience-entry-back">← 행사 안내</Link>
        <div className="audience-entry-mark" aria-hidden="true">{pending ? "…" : attendance?.active ? "✓" : "↳"}</div>
        <small>ACADEMIC FESTIVAL · QR CHECK-IN</small>
        <h1>{pending ? "입장 확인 중" : attendance?.active ? "입장 완료" : "퇴장 완료"}</h1>
        <p className="audience-entry-message" role="status" aria-live="polite">{message}</p>
        {attendance && (
          <dl className="audience-entry-info">
            <div><dt>내 입장 번호</dt><dd>{attendance.participantId}</dd></div>
            <div><dt>입장 시각</dt><dd>{enteredTime ?? "—"}</dd></div>
            <div><dt>현재 입장 인원</dt><dd>{attendance.activeCount}명</dd></div>
          </dl>
        )}
        {attendance?.active ? (
          <div className="audience-entry-exit-locked"><span aria-hidden="true">⌁</span><strong>퇴장은 출구 QR 전용</strong><small>출구에 표시된 QR을 카메라로 스캔해주세요.</small></div>
        ) : (
          <button className="audience-entry-button" type="button" disabled={pending} onClick={enterAgain}>다시 입장하기</button>
        )}
        <p className="audience-entry-note">화면 캡처나 일반 입장 QR로는 퇴장할 수 없습니다.</p>
      </section>
    </main>
  );
}
