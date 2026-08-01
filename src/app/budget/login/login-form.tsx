'use client';

import { useActionState } from 'react';

import { budgetLoginAction, type BudgetLoginFormState } from './actions';

const initialState: BudgetLoginFormState = {};

export function BudgetLoginForm() {
  const [state, formAction, pending] = useActionState(budgetLoginAction, initialState);

  return (
    <form action={formAction} className="login-form">
      <label className="login-field">
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="login-field">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p className="login-error" role="alert">{state.error}</p> : null}
      <button type="submit" className="login-button brady-login-button" disabled={pending}>
        {pending ? 'Signing in…' : 'Open Brady Budget'}
      </button>
    </form>
  );
}

