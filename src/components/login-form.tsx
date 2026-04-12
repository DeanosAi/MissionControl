'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { loginAction, type LoginFormState } from '@/app/login/actions';

const initialState: LoginFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="login-submit" disabled={pending}>
      {pending ? 'Signing in...' : 'Sign in'}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

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

      {state.error ? (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
