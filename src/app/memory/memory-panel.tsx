'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import type { MemoryNoteRecord } from '@/lib/memory';
import { deleteMemoryAction, toggleMemoryPinAction, upsertMemoryAction, type MemoryFormState } from './actions';

const initialState: MemoryFormState = {};

export function MemoryPanel({ initialNotes }: { initialNotes: MemoryNoteRecord[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [state, formAction, pending] = useActionState(upsertMemoryAction, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (state.success && formRef.current) {
    formRef.current.reset();
  }

  return (
    <section className="card page-memory-accent">
      <div className="task-board-section-header">
        <div>
          <div className="eyebrow">Memory</div>
          <h2>Curated Memory</h2>
        </div>
        <p>Persistent notes that are injected into every AI conversation. Pin important notes so they always appear first. Use chat: &quot;remember key = value&quot;.</p>
      </div>

      <a 
        href="#journal" 
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition inline-block mb-4"
      >
        ↑ Jump to Journal
      </a>

      <button
        type="button"
        className="move-task-button"
        style={{ marginBottom: '1rem' }}
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? 'Hide Form' : '+ Add Note'}
      </button>

      {showForm && (
        <form ref={formRef} action={formAction} className="task-create-form" style={{ marginBottom: '1.5rem' }}>
          <div className="task-form-grid">
            <label className="login-field">
              <span>Key</span>
              <input type="text" name="key" placeholder="e.g. project-goal" required />
            </label>
            <label className="login-field">
              <span>Category</span>
              <select name="category" defaultValue="context">
                <option value="context">Context</option>
                <option value="preference">Preference</option>
                <option value="fact">Fact</option>
                <option value="instruction">Instruction</option>
              </select>
            </label>
            <label className="login-field task-field-full">
              <span>Content</span>
              <textarea name="content" rows={3} required />
            </label>
          </div>
          {state.error && <p className="login-error">{state.error}</p>}
          {state.success && <p className="task-success">{state.success}</p>}
          <button type="submit" className="login-button task-submit" disabled={pending}>
            {pending ? 'Saving...' : 'Save Note'}
          </button>
        </form>
      )}

      <div className="stack">
        {notes.length === 0 ? (
          <p className="micro-copy">No memory notes yet. Add one above or say &quot;remember key = value&quot; in chat.</p>
        ) : (
          notes.map((note) => (
            <MemoryRow
              key={note.id}
              note={note}
              onDeleted={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
              onTogglePin={(id) => setNotes((prev) => prev.map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n))}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MemoryRow({
  note,
  onDeleted,
  onTogglePin,
}: {
  note: MemoryNoteRecord;
  onDeleted: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [deleting, startDelete] = useTransition();
  const [pinning, startPin] = useTransition();

  return (
    <div className={`journal-row${note.pinned ? ' memory-pinned' : ''}`}>
      <div>
        <div className="pill-row left">
          <span className="pill">{note.category}</span>
          {note.pinned && <span className="pill highlight">pinned</span>}
        </div>
        <h3>{note.key}</h3>
        <p>{note.content}</p>
      </div>
      <div className="memory-row-actions">
        <button
          type="button"
          className="move-task-button"
          disabled={pinning}
          onClick={() => {
            startPin(async () => {
              await toggleMemoryPinAction(note.id);
              onTogglePin(note.id);
            });
          }}
        >
          {note.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          type="button"
          className="move-task-button delete-task-button"
          disabled={deleting}
          onClick={() => {
            startDelete(async () => {
              await deleteMemoryAction(note.id);
              onDeleted(note.id);
            });
          }}
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
