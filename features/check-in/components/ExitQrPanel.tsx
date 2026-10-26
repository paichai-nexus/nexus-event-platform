"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ExitPass = { qrCode: string; exitUrl: string; expiresAt: string };

export function ExitQrPanel() {
  const [pass, setPass] = useState<ExitPass | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/attendance/exit-pass", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "퇴장 QR을 만들지 못했습니다.");
      setPass(payload.data);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "퇴장 QR을 만들지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const refreshTimer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refresh]);

  useEffect(() => {
    const updateCountdown = () => setSecondsLeft(pass ? Math.max(0, Math.ceil((new Date(pass.expiresAt).getTime() - Date.now()) / 1000)) : 0);
    const initialTimer = window.setTimeout(updateCountdown, 0);
    const countdownTimer = window.setInterval(updateCountdown, 1_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(countdownTimer);
    };
  }, [pass]);

  return (
    <section className="admin-card exit-qr-panel">
      <PanelHeader label="CONTROLLED EXIT" title="출구 전용 퇴장 QR" aside={<StatusBadge tone="warning">{secondsLeft}초</StatusBadge>} />
      {pass ? <Image className="exit-qr-panel__image" src={pass.qrCode} data-exit-url={pass.exitUrl} width={360} height={360} unoptimized alt="학생 퇴장 처리용 QR 코드" /> : <div className="exit-qr-panel__loading">QR 생성 중…</div>}
      <strong>출구 앞에서만 스캔</strong>
      <p>{error || "학생이 이 QR을 직접 스캔하면 즉시 퇴장 처리됩니다. QR은 30초마다 교체됩니다."}</p>
      <button className="admin-button" type="button" onClick={() => void refresh()}>새 QR 발급</button>
    </section>
  );
}
