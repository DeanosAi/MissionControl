import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/auth/session';
import { getDefaultBudgetHousehold, listBudgetUsers } from '@/lib/brady-budget/repository';
import { BudgetAccessForm } from './access-form';
import { setBudgetMemberActiveAction } from './actions';
import styles from './styles.module.css';

export default async function BradyBudgetAccessPage() {
  const admin = await getAdminSession();
  if (!admin) redirect('/budget/login');
  const household = await getDefaultBudgetHousehold();
  const members = await listBudgetUsers(household.id);

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <nav className={styles.links} aria-label="Back links">
          <Link href="/budget">Open Brady Budget</Link>
          <Link href="/">Mission Control</Link>
        </nav>
        <div className={styles.heading}>
          <span className={styles.logo} aria-hidden="true">BB</span>
          <div>
            <p>Brady Budget</p>
            <h1>Household access</h1>
          </div>
        </div>
        <p className={styles.intro}>Create the additional restricted login your partner will use. It opens Brady Budget only and shares the same household data.</p>

        <section className={styles.card}>
          <h2>Create or reset a login</h2>
          <BudgetAccessForm />
        </section>

        <section className={styles.card}>
          <h2>Budget-only accounts</h2>
          {members.length ? (
            <div className={styles.members}>
              {members.map((member) => (
                <article key={member.id} className={styles.member}>
                  <div>
                    <strong>{member.displayName}</strong>
                    <span>{member.email}</span>
                    <small>{member.lastLoginAt ? `Last signed in ${new Date(member.lastLoginAt).toLocaleString('en-AU')}` : 'Not signed in yet'}</small>
                  </div>
                  <form action={setBudgetMemberActiveAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <input type="hidden" name="active" value={member.isActive ? 'false' : 'true'} />
                    <button type="submit" className={member.isActive ? styles.disable : styles.enable}>
                      {member.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : <p className={styles.empty}>No additional household login has been created yet.</p>}
        </section>
      </section>
    </main>
  );
}

