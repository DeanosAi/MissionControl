import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect('/');
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">Mission Control</div>
        <h1>Admin sign in</h1>
        <p>Sign in to access the private Mission Control workspace.</p>
        <LoginForm />
      </section>
    </main>
  );
}
