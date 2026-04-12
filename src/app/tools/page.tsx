import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { tools } from '@/lib/data';

export default function ToolsPage() {
  return (
    <DashboardShell active="tools" title="Tools in the orbit." subtitle="A clean inventory of the systems and products that support the way Mission Control operates.">
      <section className="card">
        <SectionHeader title="Tools" subtitle="Useful references for the things already in play." />
        <ul className="simple-list">
          {tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
      </section>
    </DashboardShell>
  );
}
