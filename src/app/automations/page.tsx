import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { automations } from '@/lib/data';

export default function AutomationsPage() {
  return (
    <DashboardShell active="automations" title="Automations deserve a dedicated lane." subtitle="A visible home for recurring jobs, future workflows, and the background work that should not depend on memory.">
      <section className="card page-automations-accent">
        <SectionHeader title="Automations" subtitle="Current and future automation concepts for Mission Control." />
        <ul className="simple-list">
          {automations.map((automation) => (
            <li key={automation}>{automation}</li>
          ))}
        </ul>
      </section>
    </DashboardShell>
  );
}
