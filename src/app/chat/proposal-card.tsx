'use client';

import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';

import styles from './chat-workspace.module.css';

interface ProposalCardProps {
  request: OrchestrationRequestRecord;
  memoryCount?: number;
}

function classificationLabel(value: OrchestrationRequestRecord['classification']) {
  if (value === 'child-project') return 'Child project';
  if (value === 'existing-project') return 'Existing project';
  return 'New project';
}

function DetailCard({
  title,
  summary,
  children,
  open = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className={styles.detailCard} open={open}>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <span className={styles.expandIcon} aria-hidden="true">+</span>
      </summary>
      <div className={styles.detailBody}>{children}</div>
    </details>
  );
}

export function ProposalCard({ request, memoryCount = 0 }: ProposalCardProps) {
  const proposal = request.proposal;
  const preview = request.uiPreview;

  if (request.status === 'cost-approval-required' && request.routingDecision) {
    return (
      <section className={styles.proposalStack} id={`proposal-${request.id}`}>
        <article className={styles.executiveCard}>
          <span className={styles.kicker}>Cost checkpoint</span>
          <h2>Planning is paused before a paid model call.</h2>
          <p>{request.decisionNote ?? 'Mission Control needs approval for the estimated analysis cost.'}</p>
          <div className={styles.inlineFacts}>
            <span>{request.routingDecision.capability}</span>
            <span>
              {request.routingDecision.selected.estimatedCostUsd === null
                ? 'Cost not configured'
                : `$${request.routingDecision.selected.estimatedCostUsd.toFixed(4)} USD`}
            </span>
            <span>Build not started</span>
          </div>
        </article>
        <DetailCard title="Routes considered" summary="Compare the recommended route and lower-cost alternatives.">
          <div className={styles.optionList}>
            {[request.routingDecision.selected, ...request.routingDecision.alternatives].map((candidate, index) => (
              <article className={styles.optionCard} key={candidate.id}>
                <div>
                  <span className={styles.kicker}>{index === 0 ? 'Recommended' : 'Alternative'}</span>
                  <h3>{candidate.name}</h3>
                </div>
                <p>{candidate.selectionReason}</p>
                <strong>
                  {candidate.estimatedCostUsd === null
                    ? 'Cost unknown'
                    : `$${candidate.estimatedCostUsd.toFixed(4)} USD`}
                </strong>
              </article>
            ))}
          </div>
        </DetailCard>
      </section>
    );
  }

  if (!proposal || !preview) {
    return (
      <section className={styles.proposalStack} id={`proposal-${request.id}`}>
        <article className={styles.executiveCard}>
          <span className={styles.kicker}>Decision Engine</span>
          <h2>{request.projectTitle}</h2>
          <p>Mission Control is {request.status.replaceAll('-', ' ')}.</p>
        </article>
      </section>
    );
  }

  const recommendation = request.decisionAnalysis?.recommendation;
  const recommendedOption = request.decisionAnalysis?.options.find(
    (option) => option.id === recommendation?.optionId,
  );
  const alternatives = request.decisionAnalysis?.options.filter(
    (option) => option.id !== recommendation?.optionId,
  ) ?? [];

  return (
    <section className={styles.proposalStack} id={`proposal-${request.id}`}>
      <article className={styles.executiveCard}>
        <div className={styles.cardHeading}>
          <div>
            <span className={styles.kicker}>Executive summary</span>
            <h2>{proposal.title}</h2>
          </div>
          <div className={styles.statusGroup}>
            <span>{classificationLabel(request.classification)}</span>
            <span data-status={request.status}>{request.status.replaceAll('-', ' ')}</span>
          </div>
        </div>
        <p>{proposal.summary}</p>
        <div className={styles.inlineFacts}>
          <span>{proposal.complexity.level} complexity</span>
          <span>{proposal.whatWillBeBuilt.length} outcomes</span>
          <span>{memoryCount} memories used</span>
          <span>Revision {request.revision}</span>
        </div>
      </article>

      <article className={styles.recommendationCard}>
        <span className={styles.kicker}>Recommended solution</span>
        <h2>{recommendedOption?.title ?? proposal.title}</h2>
        <p>{recommendation?.rationale ?? proposal.whyThisApproach}</p>
        {request.decisionAnalysis?.challenge.explanation ? (
          <div className={styles.challenge}>
            <strong>Constructive challenge</strong>
            <p>{request.decisionAnalysis.challenge.explanation}</p>
          </div>
        ) : null}
      </article>

      <DetailCard
        title="What changes"
        summary={`${proposal.whatWillBeBuilt.length} planned outcomes and their project impact.`}
        open
      >
        <div className={styles.twoColumn}>
          <div>
            <h3>What will be built</h3>
            <ul>{proposal.whatWillBeBuilt.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h3>Expected experience</h3>
            <ol>{proposal.userExperience.map((item) => <li key={item}>{item}</li>)}</ol>
          </div>
        </div>
      </DetailCard>

      <DetailCard
        title="Alternative options"
        summary={`${alternatives.length} alternatives were evaluated before the recommendation.`}
      >
        <div className={styles.optionList}>
          {alternatives.length > 0 ? alternatives.map((option) => (
            <article className={styles.optionCard} key={option.id}>
              <h3>{option.title}</h3>
              <p>{option.summary}</p>
              <div className={styles.twoColumn}>
                <div>
                  <strong>Strengths</strong>
                  <ul>{option.advantages.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Weaknesses</strong>
                  <ul>{option.disadvantages.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
            </article>
          )) : <p>No viable alternative was retained for this proposal.</p>}
        </div>
      </DetailCard>

      <DetailCard
        title="Trade-offs and safeguards"
        summary={`${proposal.risks.length} risks, complexity, technology, and scope boundaries.`}
      >
        <div className={styles.twoColumn}>
          <div>
            <h3>Risks and safeguards</h3>
            {proposal.risks.map((item) => (
              <div className={styles.textBlock} key={item.risk}>
                <strong>{item.risk}</strong>
                <p>{item.mitigation}</p>
              </div>
            ))}
          </div>
          <div>
            <h3>Technology choices</h3>
            {proposal.technologyChoices.map((choice) => (
              <div className={styles.textBlock} key={`${choice.name}-${choice.purpose}`}>
                <strong>{choice.name}</strong>
                <p>{choice.purpose} {choice.reason}</p>
                <small>{choice.external ? 'External tool' : 'Existing Mission Control capability'}</small>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.twoColumn}>
          <div>
            <h3>Acceptance criteria</h3>
            <ul>{proposal.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h3>Not in this build</h3>
            <ul>{proposal.outOfScope.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </DetailCard>

      <DetailCard
        title="Reasoning and memory"
        summary="See the context, routing rationale, and why this recommendation was made."
      >
        <div className={styles.textBlock}>
          <strong>Context understood</strong>
          <p>{request.decisionAnalysis?.contextSummary ?? request.normalizedIntent}</p>
        </div>
        <div className={styles.textBlock}>
          <strong>Capability contribution</strong>
          <p>
            {request.routingDecision
              ? `Mission Control selected ${request.routingDecision.capability} capability based on cost, quality, privacy, availability, and past performance.`
              : 'Mission Control used its Decision Engine and project context.'}
          </p>
        </div>
        <div className={styles.textBlock}>
          <strong>Memory used</strong>
          <p>{memoryCount} relevant records were surfaced from the unified memory layer.</p>
        </div>
      </DetailCard>

      <DetailCard
        title="UI preview"
        summary={`${preview.screens.length} screen concepts · ${preview.styleDirection}`}
      >
        <div className={styles.previewGrid}>
          {preview.screens.map((screen) => (
            <article className={styles.previewScreen} key={screen.name}>
              <div className={styles.previewBar} aria-hidden="true"><i /><i /><i /></div>
              <div className={styles.previewHeading}>
                <strong>{screen.name}</strong>
                <p>{screen.purpose}</p>
              </div>
              {screen.regions.map((region) => (
                <div className={styles.previewRegion} key={`${screen.name}-${region.label}`}>
                  <span>{region.label}</span>
                  {region.content.map((item) => <p key={item}>{item}</p>)}
                  {region.interaction ? <small>{region.interaction}</small> : null}
                </div>
              ))}
            </article>
          ))}
        </div>
      </DetailCard>
    </section>
  );
}
