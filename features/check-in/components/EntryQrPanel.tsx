"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

type EntryQr = { qrCode: string; entryUrl: string; expiresAt: string };

export function EntryQrPanel() {
  const [entry, setEntry] = useState<EntryQr | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/attendance/entry-qr", { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "입장 QR을 만들지 못했습니다.");
      setEntry(payload.data);
      setError("");
    } catch (caught) {
      if (!signal?.aborted) setError(caught instanceof Error ? caught.message : "입장 QR을 만들지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialTimer = window.setTimeout(() => void refresh(controller.signal), 0);
    const refreshTimer = window.setInterval(() => void refresh(), 30_000);
    return () => { controller.abort(); window.clearTimeout(initialTimer); window.clearInterval(refreshTimer); };
  }, [refresh]);

  useEffect(() => {
    const update = () => setSecondsLeft(entry ? Math.max(0, Math.ceil((new Date(entry.expiresAt).getTime() - Date.now()) / 1000)) : 0);
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [entry]);

  return (
    <section className="admin-card entry-qr-panel">
      <PanelHeader label="AUDIENCE ENTRY" title="관객 입장 QR" aside={<StatusBadge tone="success">{secondsLeft}초</StatusBadge>} />
      {entry ? <Image className="entry-qr-panel__image" src={entry.qrCode} data-entry-url={entry.entryUrl} width={360} height={360} unoptimized alt="관객 입장 처리용 QR 코드" /> : <div className="entry-qr-panel__loading">QR 생성 중…</div>}
      <strong>관객이 휴대폰으로 스캔</strong>
      <p>{error || "이 QR을 스캔한 기기만 입장 처리됩니다. QR은 30초마다 교체됩니다."}</p>
      <button className="admin-button" type="button" onClick={() => void refresh()}>새 입장 QR 발급</button>
    </section>
  );
}
