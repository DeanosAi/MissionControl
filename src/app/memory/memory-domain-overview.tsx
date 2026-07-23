import type { MemoryDomain } from '@/lib/memory-domains/types';

const DESCRIPTIONS: Record<MemoryDomain, string> = {
  user: 'Preferences, communication style, approvals, recurring workflows, and productivity habits.',
  project: 'Project history, specifications, architecture, requirements, dependencies, and child projects.',
  decision: 'Options, trade-offs, rejected ideas, recommendations, revisions, and approvals.',
  research: 'Evaluated technologies, models, frameworks, tools, papers, benchmarks, and reports.',
  operational: 'Deployments, failures, recoveries, incidents, and infrastructure changes.',
};

export function MemoryDomainOverview({
  stats,
}: {
  stats: Array<{
    domain: MemoryDomain;
    current: number;
    archived: number;
    latestUpdate: string | null;
  }>;
}) {
  return (
    <section className="card memory-domain-overview">
      <div className="task-board-section-header">
        <div>
          <div className="eyebrow">Unified Memory Retrieval</div>
          <h2>Five specialised memory domains, one experience</h2>
        </div>
        <p>
          Mission Control searches current and archived records automatically. You never need to choose a memory store.
        </p>
      </div>
      <div className="memory-domain-grid">
        {stats.map((stat) => (
          <article className={`memory-domain-card memory-domain-${stat.domain}`} key={stat.domain}>
            <div className="memory-domain-card-heading">
              <h3>{stat.domain} memory</h3>
              <span className="pill">{stat.current} current</span>
            </div>
            <p>{DESCRIPTIONS[stat.domain]}</p>
            <div className="pill-row left">
              <span className="pill ghost">{stat.archived} archived</span>
              <span className="micro-copy">
                {stat.latestUpdate ? `Updated ${new Date(stat.latestUpdate).toLocaleDateString()}` : 'Ready for context'}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
