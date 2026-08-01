import { redirect } from 'next/navigation';

import { getBudgetAccess } from '@/lib/brady-budget/authorization';
import { BudgetLoginForm } from './login-form';

export default async function BradyBudgetLoginPage() {
  if (await getBudgetAccess()) redirect('/budget');

  return (
    <main className="login-shell brady-login-shell">
      <section className="login-card brady-login-card">
        <div className="brady-login-brand" aria-hidden="true">BB</div>
        <div className="eyebrow">Brady household</div>
        <h1>Brady Budget</h1>
        <p>Sign in to your shared household budget, bills, and live shopping list.</p>
        <BudgetLoginForm />
      </section>
    </main>
  );
}

