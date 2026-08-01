'use client';

import { useActionState } from 'react';

import { saveBudgetMemberAction, type AccessFormState } from './actions';

const initialState: AccessFormState = {};

export function BudgetAccessForm() {
  const [state, formAction, pending] = useActionState(saveBudgetMemberAction, initialState);
  return (
    <form action={formAction} className="access-form">
      <label>
        <span>Name</span>
        <input name="displayName" autoComplete="name" required placeholder="Partner name" />
      </label>
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required placeholder="partner@example.com" />
      </label>
      <label>
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      {state.error ? <p className="access-message error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="access-message success" role="status">{state.success}</p> : null}
      <button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Create or update login'}</button>
    </form>
  );
}

