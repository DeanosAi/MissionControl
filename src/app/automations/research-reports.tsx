import type { ResearchReportRecord } from '@/lib/research-engine/types';

function recommendationLabel(value: ResearchReportRecord['recommendation']) {
  if (value === 'not-recommended') return 'Not Recommended';
  if (value === 'recommended') return 'Recommended';
  return 'Optional';
}

export function ResearchReports({ reports }: { reports: ResearchReportRecord[] }) {
  return (
    <section className="card research-report-panel">
      <div className="task-board-section-header">
        <div>
          <div className="eyebrow">Research Engine</div>
          <h2>Technology recommendation reports</h2>
        </div>
        <p>
          Weekly evidence is evaluated for Mission Control. Reports never adopt a technology automatically.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="micro-copy">
          The weekly research schedule is active. Evaluated reports will appear here after its first successful run.
        </p>
      ) : (
        <div className="research-report-grid">
          {reports.map((report) => (
            <article className="research-report-card" key={report.id}>
              <header>
                <div>
                  <span className="proposal-kicker">{report.category}</span>
                  <h3>{report.title}</h3>
                  <p>{report.technology}</p>
                </div>
                <span className={`pill research-${report.recommendation}`}>
                  {recommendationLabel(report.recommendation)}
                </span>
              </header>
              <dl className="research-report-facts">
                <div><dt>What changed</dt><dd>{report.whatChanged}</dd></div>
                <div><dt>Why it matters</dt><dd>{report.whyItMatters}</dd></div>
                <div><dt>Expected impact</dt><dd>{report.expectedImpact}</dd></div>
                <div><dt>Migration difficulty</dt><dd>{report.migrationDifficulty}</dd></div>
                <div><dt>Cost implications</dt><dd>{report.costImplications}</dd></div>
              </dl>
              <div className="research-tradeoffs">
                <div>
                  <strong>Advantages</strong>
                  <ul>{report.advantages.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Disadvantages</strong>
                  <ul>{report.disadvantages.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
              <div className="decision-recommendation">
                <strong>Recommendation rationale</strong>
                <p>{report.recommendationRationale}</p>
                {report.changeExplanation ? (
                  <>
                    <strong>Why the recommendation changed</strong>
                    <p>{report.changeExplanation}</p>
                  </>
                ) : null}
              </div>
              <footer>
                <span className="pill ghost">{report.adoptionStatus.replace('-', ' ')}</span>
                <span className="micro-copy">{new Date(report.createdAt).toLocaleString()}</span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
