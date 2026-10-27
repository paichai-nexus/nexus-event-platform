export function SectionLabel({ label, title, description }: { label: string; title: string; description?: string }) {
  return (
    <div className="admin-section-heading">
      <span>{label}</span>
      <div className="admin-section-heading__copy"><h1>{title}</h1>{description && <p>{description}</p>}</div>
      <i aria-hidden="true">✦</i>
    </div>
  );
}
