'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { AI_MODELS } from '@/lib/ai/models';
import type { ChatMessageRecord } from '@/lib/chat';
import { sendChatMessageAction, type ChatFormState } from './actions';

const initialState: ChatFormState = {};

export function ChatForm({
  onUserMessage,
  onAssistantMessage,
}: {
  onUserMessage: (content: string) => void;
  onAssistantMessage: (message: ChatMessageRecord) => void;
}) {
  const [state, formAction, pending] = useActionState(sendChatMessageAction, initialState);
  const lastMessageIdRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-5.4');
  const [gptAvailable, setGptAvailable] = useState<boolean | null>(null);

  // Check GPT OAuth availability on mount and periodically
  useEffect(() => {
    let cancelled = false;
    async function checkGpt() {
      try {
        const res = await fetch('/api/gpt-status', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setGptAvailable(data.available);
        }
      } catch {
        if (!cancelled) setGptAvailable(false);
      }
    }
    checkGpt();
    const interval = setInterval(checkGpt, 20000); // check every 20s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (state.message && state.message.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = state.message.id;
      onAssistantMessage(state.message);
      formRef.current?.reset();
    }
  }, [state, onAssistantMessage]);

  const selectedModelInfo = AI_MODELS.find((m) => m.id === selectedModel);
  const isGptSelected = selectedModelInfo?.requiresOAuth === true;

  async function submitAction(formData: FormData) {
    const message = String(formData.get('message') ?? '').trim();
    if (message) {
      onUserMessage(message);
    }
    return formAction(formData);
  }

  const providerLabel = selectedModelInfo?.provider === 'openai' ? 'OpenAI (OAuth)'
    : selectedModelInfo?.provider === 'anthropic' ? 'Anthropic'
    : 'Moonshot';

  return (
    <form ref={formRef} action={submitAction} className="chat-form">
      <label className="login-field">
        <span>Model</span>
        <select name="model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
          {AI_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </label>
      <div className="chat-model-status">
        <p className="micro-copy">
          Provider: {providerLabel} · Active model: {selectedModelInfo?.name}
        </p>
        {isGptSelected && gptAvailable !== null && (
          <span className={`gpt-status-badge ${gptAvailable ? 'gpt-online' : 'gpt-offline'}`}>
            {gptAvailable ? '● GPT Online' : '○ GPT Offline — will use fallback'}
          </span>
        )}
      </div>
      <label className="login-field task-field-full">
        <span>Message</span>
        <textarea name="message" rows={4} placeholder="Message Scot from inside Mission Control…" required />
      </label>
      {state.error ? <p className="login-error">{state.error}</p> : null}
      <button type="submit" className="login-button task-submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
