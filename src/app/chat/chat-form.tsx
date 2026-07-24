'use client';

import { useActionState, useState } from 'react';

import type { ChatMessageRecord } from '@/lib/chat';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';

import { sendChatMessageAction, type ChatFormState } from './actions';
import styles from './chat-workspace.module.css';

const initialState: ChatFormState = {};

export function ChatForm({
  onUserMessage,
  onAssistantMessage,
  suggestedMessage = '',
}: {
  onUserMessage: (content: string) => void;
  onAssistantMessage: (message: ChatMessageRecord, orchestration?: OrchestrationRequestRecord) => void;
  suggestedMessage?: string;
}) {
  const [message, setMessage] = useState(suggestedMessage);
  const [state, formAction, pending] = useActionState(async (previousState: ChatFormState, formData: FormData) => {
    const submittedMessage = String(formData.get('message') ?? '').trim();
    if (submittedMessage) onUserMessage(submittedMessage);
    const result = await sendChatMessageAction(previousState, formData);
    if (result.message) onAssistantMessage(result.message, result.orchestration);
    setMessage('');
    return result;
  }, initialState);

  return (
    <form action={formAction} className={styles.composerForm}>
      <div className={styles.composerStatus}>
        <span><i /> Mission Control is ready</span>
        <small>Capabilities are selected automatically</small>
      </div>
      <div className={styles.inputRow}>
        <label>
          <span className={styles.srOnly}>What would you like Mission Control to do?</span>
          <textarea
            name="message"
            rows={2}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the outcome you want…"
            required
          />
        </label>
        <button
          type="button"
          className={styles.voiceButton}
          disabled
          title="Voice input is prepared for a future sprint"
          aria-label="Voice input coming in a future sprint"
        >
          <span aria-hidden="true">⌁</span>
          <small>Voice soon</small>
        </button>
        <button
          type="submit"
          className={styles.sendButton}
          disabled={pending || !message.trim()}
        >
          {pending ? 'Thinking…' : 'Send'}
        </button>
      </div>
      <div className={styles.composerBoundary}>
        <span>Voice-ready foundation</span>
        <p>New build requests become proposals. Nothing is implemented before approval.</p>
      </div>
      {state.error ? <p className={styles.error} role="alert">{state.error}</p> : null}
    </form>
  );
}
