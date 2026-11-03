"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { EventPart, PartAttendanceSnapshot } from "@/types/part-attendance";

type FormQr = { part: EventPart; url: string; qrCode: string };

export function AttendanceFormQrPanel() {
  const [part, setPart] = useState<EventPart>(1);
  const [form, setForm] = useState<FormQr | null>(null);
  const [snapshot, setSnapshot] = useState<PartAttendanceSnapshot | null>(null);
  const [error, setError] = useState("");

  const loadQr = useCallback(async (selectedPart: EventPart, signal?: AbortSignal) => {
    const response = await fetch(`/api/part-attendance/qr?part=${selectedPart}`, { cache: "no-store", signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "출석 QR을 만들지 못했습니다.");
    setForm(payload.data);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadQr(part, controller.signal)
        .catch((caught) => {
          if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "출석 QR을 만들지 못했습니다.");
        });
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [loadQr, part]);

  useEffect(() => {
    const load = () => fetch("/api/part-attendance", { cache: "no-store" }).then((response) => response.json()).then((payload) => payload.ok && setSnapshot(payload.data)).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 2_000);
    return () => window.clearInterval(timer);
  }, []);

  const switchPart = (selectedPart: EventPart) => {
    setForm(null);
    setError("");
    setPart(selectedPart);
  };

  return (
    <section className="admin-card external-form-qr-panel">
      <PanelHeader label="LIVE ATTENDANCE" title={`${part}부 출석 QR`} aside={<StatusBadge tone="success">{part === 1 ? snapshot?.partOneCount ?? 0 : snapshot?.partTwoCount ?? 0}명</StatusBadge>} />
      <div className="part-qr-tabs"><button type="button" className={part === 1 ? "is-active" : ""} onClick={() => switchPart(1)}>1부 QR · {snapshot?.partOneCount ?? 0}명</button><button type="button" className={part === 2 ? "is-active" : ""} onClick={() => switchPart(2)}>2부 QR · {snapshot?.partTwoCount ?? 0}명</button></div>
      {form ? <Image className="external-form-qr-panel__image" src={form.qrCode} width={720} height={720} unoptimized alt={`${part}부 출석 등록 QR 코드`} /> : <div className="external-form-qr-panel__loading">QR 생성 중…</div>}
      <strong>스크린 표시용 · 실시간 서버 출석</strong>
      <p>{error || `스캔 후 학과·학번·이름을 제출하면 ${part}부 인원에 즉시 반영됩니다. 1·2부 모두 출석 ${snapshot?.bothCount ?? 0}명.`}</p>
      {form && <a className="admin-button" href={form.url} target="_blank" rel="noreferrer">{part}부 출석 페이지 열기 ↗</a>}
    </section>
  );
}
