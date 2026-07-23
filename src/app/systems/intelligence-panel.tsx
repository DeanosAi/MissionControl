import type { ContinuousLearningSnapshot } from '@/lib/continuous-learning';

export function IntelligencePanel({
  snapshot,
}: {
  snapshot: ContinuousLearningSnapshot;
}) {
  return (
    <section className="card intelligence-panel">
      <div className="task-board-section-header">
        <div>
          <div className="eyebrow">Decision Intelligence</div>
          <h2>Continuous learning with explainable evidence</h2>
        </div>
        <p>{snapshot.explanation}</p>
      </div>
      <div className="metric-grid">
        <div className="metric-card accent-blue">
          <span>Routing events</span>
          <strong>{snapshot.routingEvents}</strong>
        </div>
        <div className="metric-card accent-yellow">
          <span>Routing success</span>
          <strong>
            {snapshot.routingSuccessRate === null
              ? 'Learning'
              : `${Math.round(snapshot.routingSuccessRate * 100)}%`}
          </strong>
        </div>
        <div className="metric-card accent-orange">
          <span>User approvals</span>
          <strong>{snapshot.approvals}</strong>
        </div>
        <div className="metric-card accent-blue-light">
          <span>Requested revisions</span>
          <strong>{snapshot.changeRequests}</strong>
        </div>
      </div>
      <div className="intelligence-principles">
        <div>
          <strong>What changes</strong>
          <p>Model reliability, value scoring, and recommendation confidence can improve from measured outcomes.</p>
        </div>
        <div>
          <strong>What never changes automatically</strong>
          <p>Approval boundaries, the Constitution, technology adoption, security policy, and user control.</p>
        </div>
        <div>
          <strong>Explainability</strong>
          <p>{snapshot.changedRecommendations} research recommendation changes currently include an evidence explanation.</p>
        </div>
      </div>
    </section>
  );
}
