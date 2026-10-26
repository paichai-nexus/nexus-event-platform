"use client";

import { useState } from "react";
import { SectionHeading } from "./SectionHeading";

export function ShareSection() {
  const [message, setMessage] = useState("");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("링크가 복사되었습니다.");
    } catch {
      setMessage("링크를 복사하지 못했습니다.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "제24회 배재대학교 경영대학 학술제", url: window.location.href });
        setMessage("");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        await copyLink();
      }
      return;
    }
    await copyLink();
  };

  return (
    <section className="section share-section" aria-labelledby="share-title">
      <div className="shell">
        <div id="share-title"><SectionHeading label="SHARE" title="이 페이지를 공유해보세요" light /></div>
        <div className="share-actions">
          <button className="button button--outline" type="button" onClick={share}><span>◯</span> 친구에게 공유</button>
          <button className="button button--outline" type="button" onClick={copyLink}><span>↗</span> 링크 복사</button>
        </div>
        <p className="share-feedback" role="status" aria-live="polite">{message}</p>
      </div>
    </section>
  );
}
