export function OperationAlert({ level, children }: { level: "INFO" | "WARNING" | "CRITICAL"; children: React.ReactNode }) {
  const symbol = level === "INFO" ? "i" : level === "WARNING" ? "!" : "×";
  return <div className={`operation-alert operation-alert--${level.toLowerCase()}`}><span>{symbol}</span><div><small>{level}</small><p>{children}</p></div></div>;
}
