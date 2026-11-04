"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type QrPayload = { ok: boolean; data?: { part: number; url: string; qrCode: string }; error?: { message?: string } };
type Counts = { partOneCount?: number; partTwoCount?: number };

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const part = searchParams.get("part") === "2" ? 2 : 1;
  const [qr, setQr] = useState<QrPayload["data"] | null>(null);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/part-attendance/qr?part=${part}`, { cache: "no-store", signal });
    const data = (await response.json()) as QrPayload;
    if (!response.ok || !data.ok || !data.data) throw new Error(data.error?.message ?? "QR을 불러오지 못했습니다.");
    setQr(data.data);
  }, [part]);

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(() => {
      void refresh(controller.signal).then(() => setError("")).catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "QR을 불러오지 못했습니다.");
      });
    }, 0);
    return () => { controller.abort(); window.clearTimeout(task); };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    async function loadCount() {
      try {
        const response = await fetch("/api/part-attendance", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { ok: boolean; data?: Counts };
        if (active && payload.ok && payload.data) setCounts(payload.data);
      } catch { /* Count is optional; QR remains usable. */ }
    }
    void loadCount();
    const interval = window.setInterval(() => void loadCount(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const count = part === 1 ? counts?.partOneCount : counts?.partTwoCount;

  return (
    <main className="admin-page" style={{ maxWidth: 740, margin: "0 auto", textAlign: "center" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link className="admin-button" href="/admin/dashboard">← 관리자 홈</Link>
        <Link className="admin-button" href={`/admin/check-in?part=${part === 1 ? 2 : 1}`}>{part === 1 ? "2부 QR 보기" : "1부 QR 보기"}</Link>
      </nav>
      <h1 style={{ fontSize: "clamp(30px, 5vw, 50px)", marginBottom: 8 }}>{part}부 출석 QR</h1>
      <p style={{ fontSize: 18, opacity: 0.8, marginBottom: 20 }}>QR 스캔 → 학과·학번·이름 입력 → 출석 완료</p>
      <section className="admin-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 30, gap: 16 }}>
        {qr ? (
          <Image src={qr.qrCode} alt={`${part}부 출석 등록 QR`} width={520} height={520} unoptimized style={{ width: "min(100%, 520px)", height: "auto", background: "white", padding: 14, borderRadius: 12 }} />
        ) : <p role="status">{error || "QR 불러오는 중…"}</p>}
        {typeof count === "number" && <strong style={{ fontSize: 26 }}>출석 완료 {count}명</strong>}
        {error && <p role="alert" style={{ color: "#ef4444" }}>{error}</p>}
        {qr && <a className="admin-button" href={qr.url} target="_blank" rel="noreferrer">출석 링크 열기</a>}
      </section>
    </main>
  );
}
