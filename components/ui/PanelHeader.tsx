export function PanelHeader({ label, title, aside }: { label: string; title: string; aside?: React.ReactNode }) {
  return (
    <header className="admin-card__heading">
      <div><small>{label}</small><h2>{title}</h2></div>
      {aside}
    </header>
  );
}
