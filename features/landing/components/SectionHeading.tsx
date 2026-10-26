type SectionHeadingProps = {
  label: string;
  title: string;
  light?: boolean;
};

export function SectionHeading({ label, title, light = false }: SectionHeadingProps) {
  return (
    <div className={`section-heading ${light ? "section-heading--light" : ""}`}>
      <span className="section-heading__label">{label}</span>
      <h2>{title}</h2>
    </div>
  );
}
