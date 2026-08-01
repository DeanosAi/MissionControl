import { redirect } from 'next/navigation';

import { getBudgetAccess } from '@/lib/brady-budget/authorization';

export default async function BradyBudgetEntryPage() {
  const access = await getBudgetAccess();
  if (!access) redirect('/budget/login');
  redirect('/brady-budget/index.html');
}

