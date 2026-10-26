export function ProgressCard({ label, value, total, completeLabel = "완료", remainingLabel = "미완료" }: { label: string; value: number; total: number; completeLabel?: string; remainingLabel?: string }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <article className="progress-card">
      <div><span>{label}</span><strong>{value} <small>/ {total}</small></strong></div>
      <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <b>{percent}%</b>
      <footer><span>{completeLabel} <strong>{value}</strong></span><span>{remainingLabel} <strong>{Math.max(total - value, 0)}</strong></span></footer>
    </article>
  );
}
