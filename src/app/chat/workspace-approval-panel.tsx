'use client';

import { useState, useTransition } from 'react';

import { DigitalPersona } from '@/components/digital-persona';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';

import {
  approvePlanningCostAction,
  approveProposalAction,
  rejectProposalAction,
  reviseProposalAction,
} from './orchestration-actions';
import styles from './chat-workspace.module.css';

export function WorkspaceApprovalPanel({
  request,
  onUpdated,
  mobile = false,
}: {
  request: OrchestrationRequestRecord | null;
  onUpdated: (request: OrchestrationRequestRecord) => void;
  mobile?: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'revise' | 'reject'>('idle');
  const [note, setNote] = useState('');
  const [externalToolsApproved, setExternalToolsApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const externalTools = request?.proposal?.technologyChoices.filter(
    (choice) => choice.external && choice.requiresApproval,
  ) ?? [];

  function run(action: () => Promise<{ request?: OrchestrationRequestRecord; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.request) {
        onUpdated(result.request);
        setMode('idle');
        setNote('');
      }
      if (result.error) setError(result.error);
    });
  }

  if (!request) {
    return (
      <aside className={`${styles.approvalPanel} ${mobile ? `${styles.mobileApproval} ${styles.mobileIdle}` : ''}`}>
        <DigitalPersona state="waiting" size="small" />
        <div>
          <span className={styles.kicker}>Approval</span>
          <strong>No proposal selected</strong>
          <p>Start a conversation to create a project proposal.</p>
        </div>
      </aside>
    );
  }

  if (request.status === 'approved' || request.status === 'rejected') {
    return (
      <aside className={`${styles.approvalPanel} ${mobile ? `${styles.mobileApproval} ${styles.mobileCompleted}` : ''}`}>
        <DigitalPersona state={request.status === 'approved' ? 'celebrating' : 'waiting'} size="small" />
        <div>
          <span className={styles.kicker}>Decision recorded</span>
          <strong>{request.status === 'approved' ? 'Proposal approved' : 'Proposal rejected'}</strong>
          <p>No implementation has started. Mission Control remains at the approval boundary.</p>
        </div>
      </aside>
    );
  }

  if (request.status === 'cost-approval-required') {
    return (
      <aside className={`${styles.approvalPanel} ${mobile ? styles.mobileApproval : ''}`}>
        <div>
          <span className={styles.kicker}>Cost approval</span>
          <strong>Approve analysis only</strong>
          <p>This permits the Decision Engine model call. It does not approve implementation.</p>
        </div>
        <button
          className={styles.primaryAction}
          type="button"
          disabled={pending}
          onClick={() => run(() => approvePlanningCostAction(request.id))}
        >
          {pending ? 'Analysing…' : 'Approve planning cost'}
        </button>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </aside>
    );
  }

  const canDecide = request.status === 'proposal-ready' || request.status === 'changes-requested';

  return (
    <aside className={`${styles.approvalPanel} ${mobile ? styles.mobileApproval : ''}`}>
      <div className={styles.approvalHeading}>
        <div>
          <span className={styles.kicker}>Approval status</span>
          <strong>{canDecide ? 'Your decision is needed' : request.status.replaceAll('-', ' ')}</strong>
        </div>
        <span className={styles.boundaryBadge}>Build stopped</span>
      </div>

      {externalTools.length > 0 ? (
        <label className={styles.externalApproval}>
          <input
            type="checkbox"
            checked={externalToolsApproved}
            onChange={(event) => setExternalToolsApproved(event.target.checked)}
          />
          <span>Also approve: {externalTools.map((choice) => choice.name).join(', ')}</span>
        </label>
      ) : null}

      <div className={styles.approvalActions}>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!canDecide || pending || (externalTools.length > 0 && !externalToolsApproved)}
          onClick={() => run(() => approveProposalAction(request.id, externalToolsApproved))}
        >
          {pending ? 'Recording…' : 'Approve'}
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={!canDecide || pending}
          onClick={() => setMode(mode === 'revise' ? 'idle' : 'revise')}
        >
          Request changes
        </button>
        <button
          type="button"
          className={styles.tertiaryAction}
          disabled={!canDecide || pending}
          onClick={() => setMode(mode === 'reject' ? 'idle' : 'reject')}
        >
          Reject
        </button>
      </div>

      {mode !== 'idle' ? (
        <div className={styles.decisionNote}>
          <label>
            <span>{mode === 'revise' ? 'What should change?' : 'Why are you rejecting this direction?'}</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={mode === 'revise'
                ? 'Make the first release simpler and prioritise mobile.'
                : 'This does not solve the original problem.'}
            />
          </label>
          <button
            type="button"
            className={mode === 'revise' ? styles.primaryAction : styles.rejectAction}
            disabled={pending || note.trim().length < 3}
            onClick={() => run(() => mode === 'revise'
              ? reviseProposalAction(request.id, note)
              : rejectProposalAction(request.id, note))}
          >
            {pending ? 'Recording…' : mode === 'revise' ? 'Revise proposal' : 'Confirm rejection'}
          </button>
        </div>
      ) : null}

      <div className={styles.quickLinks}>
        <a href={`#proposal-${request.id}`}>View full proposal</a>
        <a href={`#proposal-${request.id}`}>Compare options</a>
      </div>
      <p className={styles.boundaryCopy}>Every decision is journaled. Approval does not begin a build.</p>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </aside>
  );
}
