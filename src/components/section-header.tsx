interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <div className="eyebrow">{title}</div>
        <h2>{title}</h2>
      </div>
      <p>{subtitle}</p>
    </div>
  );
}
