export function StatusBadge({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "success" | "warning" | "danger"; className?: string }) {
  return <span className={`status-badge status-badge--${tone} ${className}`.trim()}>{children}</span>;
}
