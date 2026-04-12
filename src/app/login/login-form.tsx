'use client';

import { useActionState } from 'react';

import type { LoginFormState } from './actions';
import { loginAction } from './actions';

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

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

      {state.error ? <p className="login-error">{state.error}</p> : null}

      <button type="submit" className="login-button" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
