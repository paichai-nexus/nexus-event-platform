"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV_ITEMS } from "@/features/landing/data/eventData";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="#top" aria-label="학술제 페이지 처음으로">
          <strong>배재대학교</strong>
          <span>경영대학 학술제</span>
        </Link>
        <div className="site-header__actions">
          <Link className="header-vote" href="/vote">청중평가</Link>
          <button
            className="menu-button"
            type="button"
            aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isOpen}
            aria-controls="site-navigation"
            onClick={() => setIsOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
      <nav id="site-navigation" className={`site-nav ${isOpen ? "site-nav--open" : ""}`} aria-label="주요 메뉴">
        <div className="site-nav__inner">
          {NAV_ITEMS.map((item, index) => (
            <a key={`${item.label}-${index}`} href={item.href} onClick={() => setIsOpen(false)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
