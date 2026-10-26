"use client";

import { useEffect, useState } from "react";
import { EVENT_INFO } from "@/features/landing/data/eventData";

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(): TimeLeft | null {
  const distance = new Date(EVENT_INFO.dateTime).getTime() - Date.now();
  if (distance <= 0) return null;
  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance / 3_600_000) % 24),
    minutes: Math.floor((distance / 60_000) % 60),
    seconds: Math.floor((distance / 1_000) % 60),
  };
}

export function Countdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null | undefined>(undefined);

  useEffect(() => {
    const update = () => setTimeLeft(getTimeLeft());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="countdown-wrap shell" aria-label="행사 시작 카운트다운">
      <div className="countdown-card">
        <p className="countdown-card__kicker">ACADEMIC FESTIVAL STARTS IN</p>
        {timeLeft === null ? (
          <div className="countdown-live"><span /> LIVE NOW · 행사가 시작되었습니다.</div>
        ) : (
          <>
            <strong className="countdown-card__day" aria-live="polite">
              {timeLeft ? `D-${timeLeft.days}` : "D-—"}
            </strong>
            <div className="countdown-card__clock" aria-live="off">
              {[
                [timeLeft?.hours, "HOURS"],
                [timeLeft?.minutes, "MIN"],
                [timeLeft?.seconds, "SEC"],
              ].map(([value, label], index) => (
                <div key={String(label)}>
                  {index > 0 && <i aria-hidden="true">:</i>}
                  <span>{value === undefined ? "––" : String(value).padStart(2, "0")}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
