'use client';

import { useState, useTransition } from 'react';

import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';
import {
  approvePlanningCostAction,
  approveProposalAction,
  reviseProposalAction,
} from './orchestration-actions';

interface ProposalCardProps {
  request: OrchestrationRequestRecord;
  onUpdated: (request: OrchestrationRequestRecord) => void;
}

function classificationLabel(value: OrchestrationRequestRecord['classification']) {
  if (value === 'child-project') return 'Child project';
  if (value === 'existing-project') return 'Existing project';
  return 'New project';
}

export function ProposalCard({ request, onUpdated }: ProposalCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [externalToolsApproved, setExternalToolsApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const proposal = request.proposal;
  const preview = request.uiPreview;
  const externalTools = proposal?.technologyChoices.filter(
    (choice) => choice.external && choice.requiresApproval,
  ) ?? [];

  function approvePlanningCost() {
    setError(null);
    startTransition(async () => {
      const result = await approvePlanningCostAction(request.id);
      if (result.request) onUpdated(result.request);
      if (result.error) setError(result.error);
    });
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approveProposalAction(request.id, externalToolsApproved);
      if (result.request) onUpdated(result.request);
      if (result.error) setError(result.error);
    });
  }

  function revise() {
    setError(null);
    startTransition(async () => {
      const result = await reviseProposalAction(request.id, feedback);
      if (result.request) {
        onUpdated(result.request);
        setFeedback('');
        setShowFeedback(false);
      }
      if (result.error) setError(result.error);
    });
  }

  if (request.status === 'cost-approval-required' && request.routingDecision) {
    const selected = request.routingDecision.selected;
    return (
      <section
        id={`proposal-${request.id}`}
        className="proposal-card proposal-cost-pause"
        data-orchestration-id={request.id}
      >
        <header className="proposal-header">
          <div>
            <div className="eyebrow">Decision Engine · Cost checkpoint</div>
            <h3>Approve the planning cost?</h3>
            <p>Mission Control paused before calling a paid model. No model call or build has started.</p>
          </div>
          <span className="pill proposal-tool-approval">Approval required</span>
        </header>

        <div className="proposal-grid">
          <article className="proposal-section">
            <span className="proposal-kicker">Recommended route</span>
            <h4>{selected.name}</h4>
            <p>{selected.selectionReason}</p>
          </article>
          <article className="proposal-section">
            <span className="proposal-kicker">Estimate and limit</span>
            <h4>
              {selected.estimatedCostUsd === null
                ? 'Cost not configured'
                : `$${selected.estimatedCostUsd.toFixed(4)} USD`}
            </h4>
            <p>Configured approval threshold: ${request.routingDecision.costThresholdUsd.toFixed(4)} USD.</p>
          </article>
        </div>

        <article className="proposal-section">
          <span className="proposal-kicker">Alternative routes considered</span>
          {request.routingDecision.alternatives.length > 0 ? (
            <div className="technology-list">
              {request.routingDecision.alternatives.map((candidate) => (
                <div className="technology-row" key={candidate.id}>
                  <div>
                    <strong>{candidate.name}</strong>
                    <p>{candidate.selectionReason}</p>
                  </div>
                  <span className="pill ghost">
                    {candidate.estimatedCostUsd === null
                      ? 'Cost unknown'
                      : `$${candidate.estimatedCostUsd.toFixed(4)}`}
                  </span>
                </div>
              ))}
            </div>
          ) : <p>No suitable cheaper configured route is currently available.</p>}
        </article>

        <div className="proposal-approval-panel">
          <div>
            <span className="proposal-kicker">Scoped approval</span>
            <h4>Approve this Decision Engine analysis cost only?</h4>
            <p>This does not approve implementation, a new external tool, autonomous coding, or deployment.</p>
          </div>
          <div className="proposal-actions">
            <button
              type="button"
              className="login-button"
              disabled={pending}
              onClick={approvePlanningCost}
            >
              {pending ? 'Analysing…' : 'Approve planning cost'}
            </button>
          </div>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
        </div>
      </section>
    );
  }

  if (!proposal || !preview) {
    return (
      <section
        id={`proposal-${request.id}`}
        className="proposal-card proposal-card-pending"
        data-orchestration-id={request.id}
      >
        <div className="eyebrow">Decision Engine</div>
        <h3>{request.projectTitle}</h3>
        <p>Decision status: {request.status}</p>
      </section>
    );
  }

  return (
    <section id={`proposal-${request.id}`} className="proposal-card" data-orchestration-id={request.id}>
      <header className="proposal-header">
        <div>
          <div className="eyebrow">Decision Engine · Proposal {request.revision}</div>
          <h3>{proposal.title}</h3>
          <p>{proposal.summary}</p>
        </div>
        <div className="proposal-status-stack">
          <span className="pill highlight">{classificationLabel(request.classification)}</span>
          <span className={`pill proposal-status proposal-status-${request.status}`}>
            {request.status.replaceAll('-', ' ')}
          </span>
        </div>
      </header>

      {request.parentProjectTitle ? (
        <p className="proposal-parent">Part of <strong>{request.parentProjectTitle}</strong></p>
      ) : null}

      {request.decisionAnalysis ? (
        <article className="decision-analysis">
          <div className="decision-analysis-heading">
            <div>
              <span className="proposal-kicker">Hybrid recommendation</span>
              <h4>Approaches considered before this recommendation</h4>
            </div>
            <span className="pill highlight">
              {request.decisionAnalysis.recommendation.confidence} confidence
            </span>
          </div>
          <p className="decision-context">{request.decisionAnalysis.contextSummary}</p>
          <div className="decision-option-grid">
            {request.decisionAnalysis.options.map((option) => {
              const selected = option.id === request.decisionAnalysis?.recommendation.optionId;
              const evaluation = request.decisionAnalysis?.critique.evaluations.find(
                (item) => item.optionId === option.id,
              );
              return (
                <section
                  className={`decision-option${selected ? ' decision-option-selected' : ''}`}
                  key={option.id}
                >
                  <div className="decision-option-title">
                    <h5>{option.title}</h5>
                    {selected ? <span className="pill highlight">Recommended</span> : null}
                  </div>
                  <p>{option.summary}</p>
                  <div className="decision-option-tradeoffs">
                    <div>
                      <strong>Advantages</strong>
                      <ul>{option.advantages.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                    <div>
                      <strong>Disadvantages</strong>
                      <ul>{option.disadvantages.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  </div>
                  <div className="pill-row left">
                    <span className="pill ghost">{option.complexity} complexity</span>
                    <span className="pill ghost">{option.riskLevel} risk</span>
                    {evaluation ? <span className="pill">{evaluation.fitScore}/100 fit</span> : null}
                  </div>
                  {evaluation ? <p className="micro-copy">{evaluation.verdict}</p> : null}
                </section>
              );
            })}
          </div>
          <div className="decision-recommendation">
            <strong>Why Mission Control recommends this</strong>
            <p>{request.decisionAnalysis.recommendation.rationale}</p>
            <strong>Constructive challenge</strong>
            <p>{request.decisionAnalysis.challenge.explanation}</p>
          </div>
        </article>
      ) : null}

      {request.routingDecision ? (
        <div className="routing-summary">
          <span className="proposal-kicker">Capability routing</span>
          <p>
            Mission Control selected <strong>{request.routingDecision.selected.name}</strong> for{' '}
            <strong>{request.routingDecision.capability}</strong>.{' '}
            {request.routingDecision.selected.selectionReason}
          </p>
        </div>
      ) : null}

      <div className="proposal-grid">
        <article className="proposal-section">
          <span className="proposal-kicker">What will be built</span>
          <ul>{proposal.whatWillBeBuilt.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="proposal-section">
          <span className="proposal-kicker">Why this approach</span>
          <p>{proposal.whyThisApproach}</p>
        </article>
        <article className="proposal-section">
          <span className="proposal-kicker">Expected experience</span>
          <ol>{proposal.userExperience.map((item) => <li key={item}>{item}</li>)}</ol>
        </article>
        <article className="proposal-section">
          <span className="proposal-kicker">Complexity</span>
          <div className="proposal-complexity">
            <span className="pill">{proposal.complexity.level}</span>
            <p>{proposal.complexity.explanation}</p>
          </div>
        </article>
      </div>

      <div className="proposal-detail-grid">
        <article className="proposal-section">
          <span className="proposal-kicker">Risks and safeguards</span>
          <div className="proposal-list-stack">
            {proposal.risks.map((item) => (
              <div key={item.risk}>
                <strong>{item.risk}</strong>
                <p>{item.mitigation}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="proposal-section">
          <span className="proposal-kicker">Suggested improvements</span>
          <ul>{proposal.suggestedImprovements.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>

      <article className="proposal-section">
        <span className="proposal-kicker">Technology decisions</span>
        <div className="technology-list">
          {proposal.technologyChoices.map((choice) => (
            <div className="technology-row" key={`${choice.name}-${choice.purpose}`}>
              <div>
                <strong>{choice.name}</strong>
                <p>{choice.purpose} {choice.reason}</p>
              </div>
              {choice.external ? (
                <span className="pill proposal-tool-approval">
                  {choice.requiresApproval ? 'External · approval required' : 'External'}
                </span>
              ) : <span className="pill ghost">Existing system</span>}
            </div>
          ))}
        </div>
      </article>

      <article className="proposal-preview">
        <div className="proposal-preview-heading">
          <div>
            <span className="proposal-kicker">UI concept</span>
            <h4>Interactive wireframe preview</h4>
          </div>
          <p>{preview.styleDirection}</p>
        </div>
        <div className="wireframe-grid">
          {preview.screens.map((screen) => (
            <div className="wireframe-screen" key={screen.name}>
              <div className="wireframe-browser-bar" aria-hidden="true"><span /><span /><span /></div>
              <div className="wireframe-screen-title">
                <strong>{screen.name}</strong>
                <p>{screen.purpose}</p>
              </div>
              <div className="wireframe-regions">
                {screen.regions.map((region) => (
                  <div className="wireframe-region" key={`${screen.name}-${region.label}`}>
                    <span>{region.label}</span>
                    {region.content.map((item) => <div className="wireframe-line" key={item}>{item}</div>)}
                    {region.interaction ? <small>{region.interaction}</small> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="proposal-finish-grid">
        <article className="proposal-section">
          <span className="proposal-kicker">Beta acceptance criteria</span>
          <ul>{proposal.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="proposal-section">
          <span className="proposal-kicker">Not in this build</span>
          <ul>{proposal.outOfScope.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>

      {request.status === 'approved' ? (
        <div className="proposal-approved-message" role="status">
          <strong>Approved — ready for a future execution sprint.</strong>
          <p>No implementation has started. Sprint 1.5 stops at this approval boundary.</p>
        </div>
      ) : (
        <div className="proposal-approval-panel">
          <div>
            <span className="proposal-kicker">Your decision</span>
            <h4>{proposal.approvalPrompt}</h4>
            <p>Approval records the recommendation in Decision Memory and the Journal. It does not start a build.</p>
          </div>
          {externalTools.length > 0 ? (
            <label className="proposal-external-confirmation">
              <input
                type="checkbox"
                checked={externalToolsApproved}
                onChange={(event) => setExternalToolsApproved(event.target.checked)}
              />
              <span>I explicitly approve introducing: {externalTools.map((choice) => choice.name).join(', ')}.</span>
            </label>
          ) : null}
          <div className="proposal-actions">
            <button
              type="button"
              className="login-button"
              disabled={pending || (externalTools.length > 0 && !externalToolsApproved)}
              onClick={approve}
            >
              {pending ? 'Working…' : 'Approve proposal'}
            </button>
            <button
              type="button"
              className="move-task-button"
              disabled={pending}
              onClick={() => setShowFeedback((value) => !value)}
            >
              Request changes
            </button>
          </div>
          {showFeedback ? (
            <div className="proposal-feedback">
              <label className="login-field">
                <span>What should Mission Control change?</span>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="For example: simplify the first release and make the mobile flow the priority."
                />
              </label>
              <button
                type="button"
                className="login-button"
                disabled={pending || feedback.trim().length < 3}
                onClick={revise}
              >
                {pending ? 'Revising…' : 'Revise proposal'}
              </button>
            </div>
          ) : null}
          {error ? <p className="login-error" role="alert">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
