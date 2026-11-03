"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionHeading } from "./SectionHeading";

type QrPayload = { qrCode: string; url: string };

export function PartOneAttendanceSection() {
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadQr = async () => {
      try {
        const response = await fetch("/api/part-attendance/qr?part=1", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "QR을 불러오지 못했습니다.");
        setQr(payload.data);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "QR을 불러오지 못했습니다.");
      }
    };
    const loadCount = async () => {
      try {
        const response = await fetch("/api/part-attendance", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (response.ok && payload.ok) setCount(payload.data.partOneCount);
      } catch {
        // The QR remains usable even if the live count is temporarily unavailable.
      }
    };
    void loadQr();
    void loadCount();
    const timer = window.setInterval(() => void loadCount(), 2_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);

  return (
    <section className="section landing-attendance" id="part-one-attendance" aria-labelledby="part-one-attendance-title">
      <div className="shell">
        <div id="part-one-attendance-title"><SectionHeading label="CHECK-IN" title="1부 출석 QR" light /></div>
        <div className="landing-attendance__layout">
          <div className="landing-attendance__qr">
            {qr ? <Image src={qr.qrCode} alt="1부 출석 등록 QR 코드" width={720} height={720} unoptimized /> : <div>{error || "QR 생성 중…"}</div>}
          </div>
          <div className="landing-attendance__copy">
            <small>LIVE ATTENDANCE</small>
            <strong><b>{count}</b>명 출석 완료</strong>
            <p>행사장 스크린의 QR을 휴대폰으로 스캔하고 학과·학번·이름을 입력해주세요.</p>
            <p>1부와 2부에 동일한 학번으로 출석한 참가자는 럭키드로우 대상에 포함됩니다.</p>
            <Link className="button button--primary" href="/attendance/part-1">1부 출석 등록하기 →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
