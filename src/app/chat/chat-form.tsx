'use client';

import { useActionState, useState } from 'react';

import type { ChatMessageRecord } from '@/lib/chat';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';
import { sendChatMessageAction, type ChatFormState } from './actions';

const initialState: ChatFormState = {};

export function ChatForm({
  onUserMessage,
  onAssistantMessage,
}: {
  onUserMessage: (content: string) => void;
  onAssistantMessage: (message: ChatMessageRecord, orchestration?: OrchestrationRequestRecord) => void;
}) {
  const [message, setMessage] = useState('');
  const [state, formAction, pending] = useActionState(async (previousState: ChatFormState, formData: FormData) => {
    const submittedMessage = String(formData.get('message') ?? '').trim();
    if (submittedMessage) onUserMessage(submittedMessage);
    const result = await sendChatMessageAction(previousState, formData);
    if (result.message) onAssistantMessage(result.message, result.orchestration);
    setMessage('');
    return result;
  }, initialState);

  return (
    <form action={formAction} className="chat-form orchestration-composer-form">
      <div className="orchestration-mode-row">
        <div>
          <span className="orchestration-live-dot" aria-hidden="true" />
          <strong>Mission Control is orchestrating</strong>
        </div>
        <span className="micro-copy">Models are selected automatically</span>
      </div>

      <label className="login-field task-field-full">
        <span>What would you like Mission Control to do?</span>
        <textarea
          name="message"
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Build me a grocery tracker…"
          required
        />
      </label>
      {state.error ? <p className="login-error" role="alert">{state.error}</p> : null}
      <div className="orchestration-submit-row">
        <p>New build requests become a project and proposal. Nothing is implemented before approval.</p>
        <button type="submit" className="login-button task-submit" disabled={pending || !message.trim()}>
          {pending ? 'Thinking through it…' : 'Send to Mission Control'}
        </button>
      </div>
    </form>
  );
}
