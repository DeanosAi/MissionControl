'use client';

import { useCallback, useMemo, useState } from 'react';

import { DigitalPersona } from '@/components/digital-persona';
import type { ChatMessageRecord } from '@/lib/chat';
import type { ConversationWorkspaceContext } from '@/lib/conversation-workspace';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';

import { ChatForm } from './chat-form';
import { ProposalCard } from './proposal-card';
import { WorkspaceApprovalPanel } from './workspace-approval-panel';
import styles from './chat-workspace.module.css';

function formatDate(value: string | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Sydney',
  }).format(new Date(value));
}

function progressFor(request: OrchestrationRequestRecord | null) {
  if (!request) return 0;
  if (request.status === 'received') return 12;
  if (request.status === 'planning') return 42;
  if (request.status === 'cost-approval-required') return 48;
  if (request.status === 'proposal-ready' || request.status === 'changes-requested') return 82;
  if (request.status === 'approved' || request.status === 'rejected') return 100;
  return 25;
}

function phaseFor(request: OrchestrationRequestRecord | null) {
  if (!request) return 'Ready';
  if (request.status === 'cost-approval-required') return 'Cost review';
  if (request.status === 'proposal-ready' || request.status === 'changes-requested') return 'Proposal review';
  if (request.status === 'approved' || request.status === 'rejected') return 'Decision recorded';
  if (request.status === 'planning' || request.status === 'received') return 'Decision analysis';
  return request.status.replaceAll('-', ' ');
}

function selectActiveRequest(requests: OrchestrationRequestRecord[]) {
  return requests.find((request) => (
    request.status === 'proposal-ready'
    || request.status === 'cost-approval-required'
    || request.status === 'changes-requested'
    || request.status === 'planning'
  )) ?? requests[0] ?? null;
}

function ContextSection({
  title,
  count,
  children,
  open = false,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className={styles.contextSection} open={open}>
      <summary>
        <span>{title}</span>
        <small>{count}</small>
      </summary>
      <div>{children}</div>
    </details>
  );
}

function EmptyContext({ children }: { children: React.ReactNode }) {
  return <p className={styles.emptyContext}>{children}</p>;
}

export function ChatThread({
  initialMessages,
  initialRequests,
  initialContext,
}: {
  initialMessages: ChatMessageRecord[];
  initialRequests: OrchestrationRequestRecord[];
  initialContext: ConversationWorkspaceContext;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [requests, setRequests] = useState(initialRequests);
  const [workspaceContext, setWorkspaceContext] = useState(initialContext);
  const [suggestedPrompt, setSuggestedPrompt] = useState('');
  const activeRequest = useMemo(() => selectActiveRequest(requests), [requests]);
  const progress = progressFor(activeRequest);
  const currentProject = activeRequest
    ? {
      id: activeRequest.projectId,
      title: activeRequest.projectTitle,
      status: activeRequest.status,
      summary: activeRequest.normalizedIntent,
    }
    : workspaceContext.currentProject;
  const activeCapabilities = activeRequest
    ? ['Planning', 'Memory', 'Architecture', 'UI design']
    : ['Listening'];

  const updateRequest = useCallback((request: OrchestrationRequestRecord) => {
    setRequests((current) => {
      const exists = current.some((item) => item.id === request.id);
      return exists
        ? current.map((item) => item.id === request.id ? request : item)
        : [request, ...current];
    });
    setWorkspaceContext((current) => {
      const decisionWasRecorded = ['approved', 'rejected', 'changes-requested'].includes(request.status);
      const liveDecision = {
        id: `live-${request.id}-${request.status}-${request.revision}`,
        title: `${request.status.replaceAll('-', ' ')}: ${request.proposal?.title ?? request.projectTitle}`,
        summary: request.decisionNote ?? 'The latest decision was recorded in Mission Control.',
      };
      return {
        ...current,
        currentProject: {
          id: request.projectId,
          title: request.projectTitle,
          status: request.status,
          summary: request.normalizedIntent,
        },
        recentDecisions: decisionWasRecorded
          ? [liveDecision, ...current.recentDecisions.filter((item) => item.id !== liveDecision.id)].slice(0, 5)
          : current.recentDecisions,
      };
    });
  }, []);

  function appendUserMessage(content: string) {
    setMessages((current) => [
      ...current,
      {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content,
        projectId: null,
        orchestrationRequestId: null,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  const appendAssistantMessage = useCallback((
    message: ChatMessageRecord,
    orchestration?: OrchestrationRequestRecord,
  ) => {
    setMessages((current) => [...current, message]);
    if (orchestration) updateRequest(orchestration);
  }, [updateRequest]);

  return (
    <section className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div className={styles.projectIdentity}>
          <DigitalPersona
            state={activeRequest?.status === 'planning' ? 'thinking' : activeRequest ? 'waiting' : 'greeting'}
            size="small"
          />
          <div>
            <span className={styles.kicker}>Current project</span>
            <strong>{currentProject?.title ?? 'Ready for your next request'}</strong>
          </div>
        </div>
        <div className={styles.headerFacts}>
          <div><span>Phase</span><strong>{phaseFor(activeRequest)}</strong></div>
          <div className={styles.progressFact}>
            <span>Progress</span>
            <strong>{progress}%</strong>
            <i><b style={{ width: `${progress}%` }} /></i>
          </div>
          <div><span>Approval</span><strong>{activeRequest?.status === 'proposal-ready' ? 'Waiting on you' : phaseFor(activeRequest)}</strong></div>
          <div>
            <span>Est. cost</span>
            <strong>
              {activeRequest?.estimatedPlanningCostUsd == null
                ? '$0 / not estimated'
                : `$${activeRequest.estimatedPlanningCostUsd.toFixed(4)} USD`}
            </strong>
          </div>
          <div><span>Weekly research</span><strong>{workspaceContext.weeklyResearchStatus.label}</strong></div>
        </div>
        <div className={styles.capabilityRail} aria-label="Active capability contributions">
          {activeCapabilities.map((capability, index) => (
            <span key={capability}>
              <i style={{ width: activeRequest ? `${Math.max(35, 88 - index * 13)}%` : '20%' }} />
              {capability}
            </span>
          ))}
        </div>
      </header>

      <div className={styles.workspaceGrid}>
        <aside className={styles.contextSidebar}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.kicker}>Live context</span>
              <h2>What Mission Control knows</h2>
            </div>
            <span className={styles.liveBadge}>Live</span>
          </div>

          <ContextSection title="Current project" count={currentProject ? 1 : 0} open>
            {currentProject ? (
              <article className={styles.contextItem}>
                <strong>{currentProject.title}</strong>
                <p>{currentProject.summary}</p>
                <small>{currentProject.status.replaceAll('-', ' ')}</small>
              </article>
            ) : <EmptyContext>No active project yet.</EmptyContext>}
          </ContextSection>

          <ContextSection title="Related projects" count={workspaceContext.relatedProjects.length}>
            {workspaceContext.relatedProjects.length > 0
              ? workspaceContext.relatedProjects.map((item) => (
                <article className={styles.contextItem} key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.relationship}</p>
                  <small>{item.status}</small>
                </article>
              ))
              : <EmptyContext>No related projects found.</EmptyContext>}
          </ContextSection>

          <ContextSection title="Relevant memories" count={workspaceContext.relevantMemories.length}>
            {workspaceContext.relevantMemories.length > 0
              ? workspaceContext.relevantMemories.slice(0, 5).map((item) => (
                <article className={styles.contextItem} key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <small>{item.domain}{item.archived ? ' · retrieved from archive' : ''}</small>
                </article>
              ))
              : <EmptyContext>No relevant memory has been recorded yet.</EmptyContext>}
          </ContextSection>

          <ContextSection title="Recent decisions" count={workspaceContext.recentDecisions.length}>
            {workspaceContext.recentDecisions.length > 0
              ? workspaceContext.recentDecisions.map((item) => (
                <article className={styles.contextItem} key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </article>
              ))
              : <EmptyContext>No prior decisions for this context.</EmptyContext>}
          </ContextSection>

          <ContextSection title="Research findings" count={workspaceContext.researchFindings.length}>
            {workspaceContext.researchFindings.length > 0
              ? workspaceContext.researchFindings.map((item) => (
                <article className={styles.contextItem} key={item.id}>
                  <strong>{item.technology}</strong>
                  <p>{item.whyItMatters}</p>
                  <small>{item.recommendation} · {formatDate(item.createdAt)}</small>
                </article>
              ))
              : <EmptyContext>Weekly research has not produced findings yet.</EmptyContext>}
          </ContextSection>

          <ContextSection title="Open tasks" count={workspaceContext.openTasks.length}>
            {workspaceContext.openTasks.length > 0
              ? workspaceContext.openTasks.map((item) => (
                <article className={styles.contextItem} key={item.id}>
                  <strong>{item.title}</strong>
                  <small>{item.status} · {item.priority}</small>
                </article>
              ))
              : <EmptyContext>No open tasks in this context.</EmptyContext>}
          </ContextSection>

          <ContextSection title="Running automations" count={workspaceContext.runningAutomations.length}>
            {workspaceContext.runningAutomations.length > 0
              ? workspaceContext.runningAutomations.map((item) => (
                <article className={styles.contextItem} key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.capability}</p>
                  <small>Next: {formatDate(item.nextRun)}</small>
                </article>
              ))
              : <EmptyContext>No automations are currently active.</EmptyContext>}
          </ContextSection>

          <ContextSection title="Recently learned" count={workspaceContext.recentlyLearned.length}>
            {workspaceContext.recentlyLearned.length > 0
              ? workspaceContext.recentlyLearned.map((item) => (
                <article className={styles.contextItem} key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <small>{item.domain} memory</small>
                </article>
              ))
              : <EmptyContext>No learning has been recorded yet.</EmptyContext>}
          </ContextSection>
        </aside>

        <main className={styles.conversationArea}>
          {activeRequest ? (
            <>
              <article className={styles.requestCard}>
                <span className={styles.kicker}>Your request</span>
                <p>{activeRequest.originalRequest}</p>
              </article>
              <ProposalCard
                request={activeRequest}
                memoryCount={workspaceContext.relevantMemories.length}
              />
            </>
          ) : (
            <article className={styles.welcomeCard}>
              <DigitalPersona state="greeting" size="large" />
              <span className={styles.kicker}>Conversation workspace</span>
              <h2>Tell me the outcome you want.</h2>
              <p>I will create the project, retrieve relevant context, compare approaches, recommend a direction, and wait for your approval.</p>
              <div className={styles.promptIdeas}>
                <button type="button" onClick={() => setSuggestedPrompt('Build me a grocery tracker')}>Build me a grocery tracker</button>
                <button type="button" onClick={() => setSuggestedPrompt('Improve Mission Control’s mobile flow')}>Improve Mission Control’s mobile flow</button>
                <button type="button" onClick={() => setSuggestedPrompt('What changed in AI this week?')}>What changed in AI this week?</button>
              </div>
            </article>
          )}

          <details className={styles.history}>
            <summary>Conversation history <span>{messages.length}</span></summary>
            <div>
              {messages.map((message) => (
                <article className={styles.historyMessage} data-role={message.role} key={message.id}>
                  <span>{message.role === 'assistant' ? 'Mission Control' : 'You'}</span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          </details>

          <div className={styles.composer}>
            <ChatForm
              key={suggestedPrompt}
              onUserMessage={appendUserMessage}
              onAssistantMessage={appendAssistantMessage}
              suggestedMessage={suggestedPrompt}
            />
          </div>
        </main>

        <div className={styles.approvalColumn}>
          <WorkspaceApprovalPanel request={activeRequest} onUpdated={updateRequest} />
        </div>
      </div>

      <WorkspaceApprovalPanel
        request={activeRequest}
        onUpdated={updateRequest}
        mobile
      />
    </section>
  );
}
