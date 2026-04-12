'use client';

import { useState, useTransition } from 'react';
import type { LocalModelRecord } from '@/lib/local-llm/client';

export function LocalModelsClient({
  initialModels,
  lmStudioDetected,
  lmStudioModels,
}: {
  initialModels: LocalModelRecord[];
  lmStudioDetected: boolean;
  lmStudioModels: string[];
}) {
  const [models, setModels] = useState(initialModels);
  const [showForm, setShowForm] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [, startTransition] = useTransition();

  async function handleTest(endpoint: string, modelId: string) {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/local-models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, modelId }),
      });
      if (res.ok) setTestResult(await res.json());
      else setTestResult({ success: false, error: 'Test request failed' });
    } catch { setTestResult({ success: false, error: 'Network error' }); }
    finally { setTesting(false); }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const endpoint = (form.elements.namedItem('endpoint') as HTMLInputElement).value;
    const modelId = (form.elements.namedItem('modelId') as HTMLInputElement).value;
    const contextWindow = parseInt((form.elements.namedItem('contextWindow') as HTMLInputElement).value) || 4096;

    const res = await fetch('/api/local-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, endpoint, modelId, contextWindow }),
    });
    if (res.ok) {
      const model = await res.json();
      setModels(prev => [model, ...prev]);
      form.reset();
      setShowForm(false);
      setTestResult(null);
    }
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      await fetch('/api/local-models', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setModels(prev => prev.filter(m => m.id !== id));
    });
  }

  async function handleToggle(id: string) {
    startTransition(async () => {
      await fetch('/api/local-models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setModels(prev => prev.map(m => m.id === id ? { ...m, status: m.status === 'active' ? 'inactive' as const : 'active' as const } : m));
    });
  }

  async function handleAddLMStudioModel(lmModelId: string) {
    const res = await fetch('/api/local-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lmModelId,
        endpoint: 'http://localhost:1234/v1/chat/completions',
        modelId: lmModelId,
        contextWindow: 4096,
      }),
    });
    if (res.ok) {
      const model = await res.json();
      setModels(prev => [model, ...prev]);
    }
  }

  return (
    <>
      {/* LM Studio auto-detect */}
      {lmStudioDetected && lmStudioModels.length > 0 && (
        <section className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <div className="task-board-section-header">
            <div>
              <div className="eyebrow">Auto-Detected</div>
              <h2>LM Studio Models Found</h2>
            </div>
          </div>
          <p className="micro-copy" style={{ marginBottom: '0.75rem' }}>
            LM Studio is running at localhost:1234 with {lmStudioModels.length} model{lmStudioModels.length > 1 ? 's' : ''} available.
          </p>
          <div className="stack">
            {lmStudioModels.map(m => {
              const alreadyAdded = models.some(existing => existing.modelId === m);
              return (
                <div key={m} className="journal-row">
                  <div><h3>{m}</h3><p className="micro-copy">localhost:1234</p></div>
                  {alreadyAdded ? (
                    <span className="pill ghost">Added</span>
                  ) : (
                    <button type="button" className="move-task-button" onClick={() => handleAddLMStudioModel(m)}>+ Add</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Add model form */}
      <section className="card">
        <div className="task-board-section-header">
          <div>
            <div className="eyebrow">Manual Setup</div>
            <h2>Add Local Model</h2>
          </div>
          <button type="button" className="run-task-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Model'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="task-create-form" style={{ marginBottom: '1.5rem' }}>
            <div className="task-form-grid">
              <label className="login-field">
                <span>Model Name</span>
                <input type="text" name="name" placeholder="e.g. Llama 3 8B" required />
              </label>
              <label className="login-field">
                <span>Endpoint URL</span>
                <input type="text" name="endpoint" defaultValue="http://localhost:1234/v1/chat/completions" required />
              </label>
              <label className="login-field">
                <span>Model ID</span>
                <input type="text" name="modelId" placeholder="e.g. llama-3-8b" required />
              </label>
              <label className="login-field">
                <span>Context Window</span>
                <input type="number" name="contextWindow" defaultValue={4096} />
              </label>
            </div>
            <div className="local-model-test-row">
              <button type="button" className="move-task-button" disabled={testing} onClick={() => {
                const form = document.querySelector('.task-create-form') as HTMLFormElement;
                const ep = (form?.elements.namedItem('endpoint') as HTMLInputElement)?.value;
                const mid = (form?.elements.namedItem('modelId') as HTMLInputElement)?.value;
                if (ep && mid) handleTest(ep, mid);
              }}>
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult && (
                <span className={testResult.success ? 'test-success' : 'test-error'}>
                  {testResult.success ? `✓ Connected (${testResult.latencyMs}ms)` : `✗ ${testResult.error}`}
                </span>
              )}
            </div>
            <button type="submit" className="login-button task-submit">Add Model</button>
          </form>
        )}
      </section>

      {/* Models list */}
      <section className="card">
        <div className="task-board-section-header">
          <div>
            <div className="eyebrow">Registered</div>
            <h2>Local Models ({models.length})</h2>
          </div>
        </div>
        <div className="stack">
          {models.length === 0 ? (
            <p className="micro-copy">No local models registered. Add one above or start LM Studio for auto-detection.</p>
          ) : (
            models.map(m => (
              <div key={m.id} className="journal-row">
                <div>
                  <div className="pill-row left">
                    <span className={`pill ${m.status === 'active' ? 'highlight' : 'ghost'}`}>{m.status}</span>
                    <span className="pill ghost">{m.contextWindow} ctx</span>
                  </div>
                  <h3>{m.name}</h3>
                  <p className="micro-copy">{m.endpoint} · model: {m.modelId}</p>
                </div>
                <div className="memory-row-actions">
                  <button type="button" className="move-task-button" onClick={() => {
                    handleTest(m.endpoint, m.modelId);
                  }}>Test</button>
                  <button type="button" className="move-task-button" onClick={() => handleToggle(m.id)}>
                    {m.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="move-task-button delete-task-button" onClick={() => handleDelete(m.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
        {testResult && (
          <div className="micro-copy" style={{ marginTop: '0.5rem' }}>
            Last test: {testResult.success ? `✓ Connected (${testResult.latencyMs}ms)` : `✗ ${testResult.error}`}
          </div>
        )}
      </section>
    </>
  );
}
