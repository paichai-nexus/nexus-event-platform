"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { EVENT_STATUS_LABELS } from "@/types/event";

export function AdminHeader({ onMenu, role }: { onMenu: () => void; role: "ADMIN" | "STAFF" }) {
  const { state } = useEventOps();
  const [time, setTime] = useState("--:--:--");
  const [serverReachable, setServerReachable] = useState(true);

  useEffect(() => {
    let active = true;
    const updateTime = () => setTime(new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date()));
    const checkServer = async () => {
      try {
        const response = await fetch("/api/event/snapshot", { cache: "no-store" });
        if (active) setServerReachable(response.ok);
      } catch {
        if (active) setServerReachable(false);
      }
    };
    updateTime();
    void checkServer();
    const clockTimer = window.setInterval(updateTime, 1000);
    const healthTimer = window.setInterval(() => void checkServer(), 15_000);
    window.addEventListener("online", checkServer);
    window.addEventListener("offline", checkServer);
    return () => {
      active = false;
      window.clearInterval(clockTimer);
      window.clearInterval(healthTimer);
      window.removeEventListener("online", checkServer);
      window.removeEventListener("offline", checkServer);
    };
  }, []);

  const online = serverReachable && state.networkOverride === "ONLINE";
  return (
    <>
      <header className="admin-header">
        <div className="admin-header__brand">
          <button type="button" aria-label="관리자 메뉴 열기" onClick={onMenu}>☰</button>
          <div><strong>제24회 배재대학교 경영대학 학술제</strong><small>2026. 11. 04. WED · 배재대학교 21세기관</small></div>
        </div>
        <div className="admin-header__status">
          <StatusBadge tone="blue" className="admin-header__event-status">{EVENT_STATUS_LABELS[state.status]}</StatusBadge>
          <StatusBadge tone={online ? "success" : "danger"}>{online ? "● ONLINE" : "× OFFLINE"}</StatusBadge>
          <time aria-label={`현재 시각 ${time}`}>◷ {time}</time>
          <span className="admin-role">● {role}</span>
        </div>
      </header>
      {!online && <div className="offline-banner" role="alert"><strong>OFFLINE</strong> 네트워크 연결을 확인해주세요. 현재 작업이 서버에 반영되지 않을 수 있습니다.</div>}
    </>
  );
}
