'use client';

import { useState, useTransition } from 'react';

import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';
import { approveProposalAction, reviseProposalAction } from './orchestration-actions';

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
  const externalTools = proposal?.technologyChoices.filter((choice) => choice.external && choice.requiresApproval) ?? [];

  if (!proposal || !preview) {
    return (
      <section id={`proposal-${request.id}`} className="proposal-card proposal-card-pending" data-orchestration-id={request.id}>
        <div className="eyebrow">Conversational Bridge</div>
        <h3>{request.projectTitle}</h3>
        <p>Proposal status: {request.status}</p>
      </section>
    );
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

  return (
    <section id={`proposal-${request.id}`} className="proposal-card" data-orchestration-id={request.id}>
      <header className="proposal-header">
        <div>
          <div className="eyebrow">Conversational Bridge · Proposal {request.revision}</div>
          <h3>{proposal.title}</h3>
          <p>{proposal.summary}</p>
        </div>
        <div className="proposal-status-stack">
          <span className="pill highlight">{classificationLabel(request.classification)}</span>
          <span className={`pill proposal-status proposal-status-${request.status}`}>{request.status.replace('-', ' ')}</span>
        </div>
      </header>

      {request.parentProjectTitle ? (
        <p className="proposal-parent">Part of <strong>{request.parentProjectTitle}</strong></p>
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
          <strong>Approved — ready for the next sprint.</strong>
          <p>No implementation has started. Sprint 1 stops at this approval boundary.</p>
        </div>
      ) : (
        <div className="proposal-approval-panel">
          <div>
            <span className="proposal-kicker">Your decision</span>
            <h4>{proposal.approvalPrompt}</h4>
            <p>Approval records the decision in the project journal. It does not start a build.</p>
          </div>
          {externalTools.length > 0 ? (
            <label className="proposal-external-confirmation">
              <input
                type="checkbox"
                checked={externalToolsApproved}
                onChange={(event) => setExternalToolsApproved(event.target.checked)}
              />
              <span>
                I explicitly approve introducing: {externalTools.map((choice) => choice.name).join(', ')}.
              </span>
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
            <button type="button" className="move-task-button" disabled={pending} onClick={() => setShowFeedback((value) => !value)}>
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
              <button type="button" className="login-button" disabled={pending || feedback.trim().length < 3} onClick={revise}>
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
