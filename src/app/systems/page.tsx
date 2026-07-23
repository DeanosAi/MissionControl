import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { systems } from '@/lib/data';
import { getSystemHealth } from '@/lib/system-health';
import { getContinuousLearningSnapshot } from '@/lib/continuous-learning';
import { SystemHealthPanel } from './health-panel';
import { IntelligencePanel } from './intelligence-panel';

export default async function SystemsPage() {
  const [health, intelligence] = await Promise.all([
    getSystemHealth(),
    getContinuousLearningSnapshot(),
  ]);

  return (
    <DashboardShell
      active="systems"
      title="Systems"
      subtitle="Hosting, system health, capability routing outcomes, cost awareness, and continuous-learning visibility."
    >
      <SystemHealthPanel initialHealth={health} />
      <IntelligencePanel snapshot={intelligence} />

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
