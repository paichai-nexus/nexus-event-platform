export function StatCard({ label, value, detail, accent = false, icon = "◇", progress }: { label: string; value: string | number; detail?: string; accent?: boolean; icon?: string; progress?: number }) {
  return (
    <article className={`stat-card ${accent ? "stat-card--accent" : ""}`}>
      <header><span>{label}</span><i aria-hidden="true">{icon}</i></header><strong>{value}</strong>{detail && <small>{detail}</small>}
      {typeof progress === "number" && <div className="stat-card__track"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}
    </article>
  );
}
