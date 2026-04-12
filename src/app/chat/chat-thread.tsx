'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessageRecord } from '@/lib/chat';
import { ChatForm } from './chat-form';

/** Render chat content with basic markdown-like formatting for task output */
function ChatContent({ content }: { content: string }) {
  // Split content into lines and render with basic formatting
  const lines = content.split('\n');

  return (
    <div className="chat-content">
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        });

        // Bullet lines
        if (line.trim().startsWith('•') || line.trim().startsWith('- ')) {
          return <p key={i} className="chat-bullet">{rendered}</p>;
        }

        // Empty lines become spacing
        if (line.trim() === '') {
          return <br key={i} />;
        }

        // Emoji-prefixed section headers (from task list formatting)
        if (/^[📋🔄👁✅📦❌]/.test(line.trim())) {
          return <p key={i} className="chat-section-header">{rendered}</p>;
        }

        return <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

export function ChatThread({ initialMessages }: { initialMessages: ChatMessageRecord[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const visibleMessages = useMemo(() => messages, [messages]);

  function appendUserMessage(content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function appendAssistantMessage(message: ChatMessageRecord) {
    setMessages((prev) => {
      const withoutTrailingLocalUser = [...prev];
      return [...withoutTrailingLocalUser, message];
    });
  }

  return (
    <section className="chat-shell card page-home-accent">
      <div className="chat-shell-header task-board-section-header">
        <div>
          <div className="eyebrow">Chat</div>
          <h2>Mission Control Chat</h2>
        </div>
        <p>Chat with Scot about projects, ideas, content, and operations. Use task commands like &quot;list tasks&quot;, &quot;create task: title&quot;, or &quot;run task name&quot;.</p>
      </div>

      <div ref={scrollRef} className="chat-thread chat-scroll-region">
        {visibleMessages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Try &quot;list tasks&quot; to see your current tasks.</p>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <article key={message.id} className={`chat-bubble chat-${message.role}`}>
              <span className="micro-copy chat-role-label">{message.role}</span>
              <ChatContent content={message.content} />
            </article>
          ))
        )}
      </div>

      <div className="chat-composer">
        <ChatForm onUserMessage={appendUserMessage} onAssistantMessage={appendAssistantMessage} />
      </div>
    </section>
  );
}
