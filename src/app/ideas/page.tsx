import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { ideas, suggestedIdeas } from '@/lib/data';

export default function IdeasPage() {
  return (
    <DashboardShell
      active="ideas"
      title="Ideas with room to grow into projects."
      subtitle="Capture the things worth building now, and leave space for future agent-generated suggestions to slot in naturally."
    >
      <section className="grid-two page-ideas">
        <article className="card page-ideas-accent">
          <SectionHeader title="Ideas" subtitle="Manual capture, shaping, and promotion into future projects." />
          <div className="stack">
            {ideas.map((idea) => (
              <div key={idea.id} className="list-row">
                <div>
                  <h3>{idea.title}</h3>
                  <p>{idea.summary}</p>
                </div>
                <div className="pill-row">
                  <span className="pill highlight">{idea.status}</span>
                  {idea.tags.map((tag) => (
                    <span key={tag} className="pill ghost">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card accent-card page-ideas-accent">
          <SectionHeader
            title="Suggested Ideas"
            subtitle="A dedicated lane for future scans so the app can surface build opportunities automatically."
          />
          <div className="stack">
            {suggestedIdeas.map((idea) => (
              <div key={idea.id} className="list-row compact">
                <div>
                  <h3>{idea.title}</h3>
                  <p>{idea.reason}</p>
                  <span className="micro-copy">Source: {idea.source}</span>
                </div>
                <span className="pill">{idea.status}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
