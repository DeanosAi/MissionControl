'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessageRecord } from '@/lib/chat';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';
import { ChatForm } from './chat-form';
import { ProposalCard } from './proposal-card';

function ChatContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="chat-content">
      {lines.map((line, index) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, partIndex) => part.startsWith('**') && part.endsWith('**')
          ? <strong key={partIndex}>{part.slice(2, -2)}</strong>
          : <span key={partIndex}>{part}</span>);

        if (line.trim().startsWith('•') || line.trim().startsWith('- ')) {
          return <p key={index} className="chat-bullet">{rendered}</p>;
        }
        if (!line.trim()) return <br key={index} />;
        return <p key={index}>{rendered}</p>;
      })}
    </div>
  );
}

export function ChatThread({
  initialMessages,
  initialRequests,
}: {
  initialMessages: ChatMessageRecord[];
  initialRequests: OrchestrationRequestRecord[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [requests, setRequests] = useState(initialRequests);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, requests]);

  const requestMap = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests]);
  const inlineRequestIds = useMemo(() => new Set(
    messages
      .filter((message) => message.role === 'assistant' && message.orchestrationRequestId)
      .map((message) => message.orchestrationRequestId as string),
  ), [messages]);

  const updateRequest = useCallback((request: OrchestrationRequestRecord) => {
    setRequests((current) => {
      const exists = current.some((item) => item.id === request.id);
      return exists
        ? current.map((item) => item.id === request.id ? request : item)
        : [request, ...current];
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

  const unlinkedRequests = requests.filter((request) => !inlineRequestIds.has(request.id));

  return (
    <section className="chat-shell card page-home-accent orchestration-shell">
      <div className="chat-shell-header task-board-section-header orchestration-header">
        <div>
          <div className="eyebrow">Conversational Bridge</div>
          <h2>Describe the outcome. Mission Control handles the planning.</h2>
        </div>
        <p>Requests become structured projects, product proposals, and UI previews. You approve the direction before any implementation begins.</p>
      </div>

      <div ref={scrollRef} className="chat-thread chat-scroll-region orchestration-thread">
        <div className="orchestration-welcome">
          <span className="orchestration-orbit" aria-hidden="true">MC</span>
          <div>
            <strong>Start with the result you want.</strong>
            <p>Try “Build me a grocery tracker.” Mission Control will work out the product shape, explain its decisions, and wait for you.</p>
          </div>
        </div>

        {messages.map((message) => {
          const request = message.role === 'assistant' && message.orchestrationRequestId
            ? requestMap.get(message.orchestrationRequestId)
            : undefined;
          return (
            <Fragment key={message.id}>
              <article className={`chat-bubble chat-${message.role}`}>
                <span className="micro-copy chat-role-label">
                  {message.role === 'assistant' ? 'Mission Control' : message.role}
                </span>
                <ChatContent content={message.content} />
              </article>
              {request ? <ProposalCard request={request} onUpdated={updateRequest} /> : null}
            </Fragment>
          );
        })}

        {unlinkedRequests.map((request) => (
          <ProposalCard key={request.id} request={request} onUpdated={updateRequest} />
        ))}
      </div>

      <div className="chat-composer">
        <ChatForm onUserMessage={appendUserMessage} onAssistantMessage={appendAssistantMessage} />
      </div>
    </section>
  );
}
