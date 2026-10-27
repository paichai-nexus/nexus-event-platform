export function HeroSection() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__grid" aria-hidden="true" />
      <div className="hero__orb hero__orb--one" aria-hidden="true" />
      <div className="hero__orb hero__orb--two" aria-hidden="true" />
      <div className="hero__content shell">
        <div className="hero__eyebrow"><span>제24회</span> PAI CHAI · 2026</div>
        <h1 id="hero-title">
          <span>배재대학교</span>
          <strong>경영대학 학술제</strong>
        </h1>
        <div className="hero__english">
          PAI CHAI UNIVERSITY<br />
          COLLEGE OF BUSINESS<br />
          ACADEMIC FESTIVAL
        </div>
        <div className="hero__paper">
          <p>2026. 11. 04. WED</p>
          <strong>배재대학교 21세기관</strong>
        </div>
        <p className="hero__scribble" aria-hidden="true">Ideas connect people ↗</p>
      </div>
      <div className="hero__tear" aria-hidden="true" />
    </section>
  );
}
