'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import type { JournalEntryRecord } from '@/lib/journal';
import { createJournalAction, deleteJournalAction, type JournalFormState } from './actions';

const initialState: JournalFormState = {};

export function JournalPanel({ initialEntries }: { initialEntries: JournalEntryRecord[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [state, formAction, pending] = useActionState(createJournalAction, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <section className="card page-memory-accent">
      <div className="task-board-section-header">
        <div>
          <div className="eyebrow">Journal</div>
          <h2>Project Journal</h2>
        </div>
        <p>Milestones, decisions, and ops entries. Auto-entries are created when tasks execute or complete.</p>
      </div>

      <button
        type="button"
        className="move-task-button"
        style={{ marginBottom: '1rem' }}
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? 'Hide Form' : '+ Add Entry'}
      </button>

      {showForm && (
        <form ref={formRef} action={formAction} className="task-create-form" style={{ marginBottom: '1.5rem' }}>
          <div className="task-form-grid">
            <label className="login-field">
              <span>Title</span>
              <input type="text" name="title" required />
            </label>
            <label className="login-field">
              <span>Type</span>
              <select name="entryType" defaultValue="note">
                <option value="milestone">Milestone</option>
                <option value="ops">Ops</option>
                <option value="decision">Decision</option>
                <option value="note">Note</option>
              </select>
            </label>
            <label className="login-field task-field-full">
              <span>Detail</span>
              <textarea name="detail" rows={3} required />
            </label>
          </div>
          {state.error && <p className="login-error">{state.error}</p>}
          {state.success && <p className="task-success">{state.success}</p>}
          <button type="submit" className="login-button task-submit" disabled={pending}>
            {pending ? 'Adding...' : 'Add Entry'}
          </button>
        </form>
      )}

      <div className="stack">
        {entries.length === 0 ? (
          <p className="micro-copy">No journal entries yet.</p>
        ) : (
          entries.map((entry) => (
            <JournalRow
              key={entry.id}
              entry={entry}
              onDeleted={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
            />
          ))
        )}
      </div>
    </section>
  );
}

function JournalRow({ entry, onDeleted }: { entry: JournalEntryRecord; onDeleted: (id: string) => void }) {
  const [deleting, startDelete] = useTransition();
  const date = entry.createdAt.split('T')[0];
  const typeColors: Record<string, string> = {
    milestone: 'highlight', ops: '', decision: 'ghost', auto: 'ghost', note: '',
  };

  return (
    <div className="journal-row">
      <div>
        <div className="pill-row left">
          <span className={`pill ${typeColors[entry.entryType] || ''}`}>{entry.entryType}</span>
          <span className="micro-copy">{date}</span>
          {entry.source !== 'manual' && <span className="micro-copy">via {entry.source}</span>}
        </div>
        <h3>{entry.title}</h3>
        <p>{entry.detail}</p>
      </div>
      <button
        type="button"
        className="move-task-button delete-task-button"
        disabled={deleting}
        onClick={() => {
          startDelete(async () => {
            await deleteJournalAction(entry.id);
            onDeleted(entry.id);
          });
        }}
      >
        {deleting ? '...' : 'Delete'}
      </button>
    </div>
  );
}
