import { DashboardShell } from '@/components/dashboard-shell';
import { getUsageSnapshot } from '@/lib/usage';

export default async function UsagePage() {
  const usage = await getUsageSnapshot();

  return (
    <DashboardShell
      active="usage"
      title="Usage and Limits"
      subtitle="A dedicated view for OpenAI/Codex and Anthropic provider status, designed to become the operational rate-limit page for Mission Control."
    >
      <section className="grid-two">
        <article className="card page-home-accent">
          <div className="task-board-section-header">
            <div>
              <div className="eyebrow">OpenAI / Codex</div>
              <h2>Current usage</h2>
            </div>
            <p>Mission Control reads the latest verified host-side usage snapshot and displays it here.</p>
          </div>
          <div className="usage-detail-grid">
            <div className="metric-card accent-blue">
              <span>Window left</span>
              <strong>{usage.openai.windowLeft}</strong>
            </div>
            <div className="metric-card accent-blue-light">
              <span>Resets in</span>
              <strong>{usage.openai.resetIn}</strong>
            </div>
            <div className="metric-card accent-blue">
              <span>Weekly left</span>
              <strong>{usage.openai.weeklyLeft}</strong>
            </div>
            <div className="metric-card accent-blue-light">
              <span>Weekly reset</span>
              <strong>{usage.openai.weeklyResetIn}</strong>
            </div>
          </div>
          <p className="micro-copy">Source: {usage.openai.source}</p>
        </article>

        <article className="card page-systems-accent">
          <div className="task-board-section-header">
            <div>
              <div className="eyebrow">Anthropic</div>
              <h2>Provider status</h2>
            </div>
            <p>Mission Control shows the verified Anthropic provider state without pretending to know billing figures it cannot prove.</p>
          </div>
          <div className="usage-detail-grid single-column">
            <div className="metric-card accent-violet">
              <span>Status</span>
              <strong>{usage.claude.status}</strong>
            </div>
            <div className="card muted-card">
              <p>{usage.claude.note}</p>
              <p className="micro-copy">Source: {usage.claude.source}</p>
            </div>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
