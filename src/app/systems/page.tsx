import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { systems } from '@/lib/data';
import { getSystemHealth } from '@/lib/system-health';
import { SystemHealthPanel } from './health-panel';

export default async function SystemsPage() {
  const health = await getSystemHealth();

  return (
    <DashboardShell
      active="systems"
      title="Systems"
      subtitle="Hosting context, system health, backup status, and operational visibility."
    >
      <SystemHealthPanel initialHealth={health} />

      <section className="card page-systems-accent">
        <SectionHeader title="Infrastructure" subtitle="Hosting, security, runtime, and deployment context." />
        <div className="stack">
          {systems.map((system) => (
            <div key={system.label} className="meta-row">
              <span>{system.label}</span>
              <strong>{system.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
