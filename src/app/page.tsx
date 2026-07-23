import Image from 'next/image';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { recentActivity } from '@/lib/data';
import { getUsageSnapshot } from '@/lib/usage';
import { HomeUsagePanel } from './home-usage-panel';
import { listOrchestrationRequests } from '@/lib/conversational-bridge/repository';
import { listIdeas } from '@/lib/ideas';
import { listJournalEntries } from '@/lib/journal';
import { listProjects } from '@/lib/projects';
import { listTasks } from '@/lib/tasks';

export default async function HomePage() {
  const [usage, journalEntries, tasks, projects, ideas, requests] = await Promise.all([
    getUsageSnapshot(),
    listJournalEntries(100).catch(() => []),
    listTasks().catch(() => []),
    listProjects().catch(() => []),
    listIdeas().catch(() => []),
    listOrchestrationRequests(100).catch(() => []),
  ]);

  const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');

  return (
    <DashboardShell active="home" title="Mission Control" subtitle="">
      <section className="hero card hero-card hero-top banner-hero page-home">
        <Image
          src="/mission-control-banner.svg"
          alt="Mission Control banner"
          width={1600}
          height={420}
          className="hero-banner"
          priority
        />
      </section>

      <section className="card home-orchestration-cta">
        <div>
          <div className="eyebrow">Mission Control V3</div>
          <h2>Start with a conversation.</h2>
          <p>Describe the outcome you want. Mission Control will create the project, think through the product, show a UI concept, and wait for approval.</p>
        </div>
        <Link href="/chat" className="login-button home-orchestration-button">Open Orchestrator →</Link>
      </section>

      <HomeUsagePanel initialUsage={usage} />

      <section className="metric-grid metric-grid-spread">
        <div className="metric-card accent-yellow">
          <span>Ideas tracked</span>
          <strong>{ideas.length}</strong>
        </div>
        <div className="metric-card accent-blue">
          <span>Active tasks</span>
          <strong>{activeTasks.length}</strong>
        </div>
        <div className="metric-card accent-blue-light">
          <span>Projects</span>
          <strong>{projects.length}</strong>
        </div>
        <div className="metric-card accent-orange">
          <span>Journal entries</span>
          <strong>{journalEntries.length}</strong>
        </div>
      </section>

      <section className="grid-two overview-grid">
        <article className="card page-home-accent">
          <SectionHeader
            title="Recent Activity"
            subtitle="A quick pulse on the most important work happening around Mission Control."
          />
          <div className="stack">
            {recentActivity.map((item) => (
              <div key={item} className="list-row compact">
                <div>
                  <h3>{item}</h3>
                </div>
                <span className="pill ghost">updated</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card accent-card page-home-accent">
          <SectionHeader
            title="Live Snapshot"
            subtitle="A compact view of what currently has motion and what deserves attention next."
          />
          <div className="snapshot-grid">
            <div className="snapshot-card accent-blue">
              <span>Top project</span>
              <strong>{projects[0]?.title ?? 'No project yet'}</strong>
              <p>{projects[0]?.summary ?? 'Start in the Orchestrator to create one.'}</p>
            </div>
            <div className="snapshot-card accent-blue-light">
              <span>Active tasks</span>
              <strong>{activeTasks.length} in progress</strong>
              <p>{activeTasks.slice(0, 2).map(t => t.title).join(', ') || 'None right now'}</p>
            </div>
            <div className="snapshot-card accent-yellow">
              <span>Conversational proposals</span>
              <strong>{requests.length}</strong>
              <p>{requests.filter((request) => request.status === 'proposal-ready').length} waiting for approval</p>
            </div>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
