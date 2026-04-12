import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { requireAdminSession } from '@/lib/auth/session';
import type { DashboardKey } from '@/lib/data';

interface DashboardShellProps {
  active: DashboardKey;
  title: string;
  subtitle: string;
  children: ReactNode;
}

export async function DashboardShell({ active, title, subtitle, children }: DashboardShellProps) {
  await requireAdminSession();

  return (
    <div className="app-shell">
      <Sidebar active={active} />
      <main className="main-column">
        <section className="page-intro">
          <div>
            <div className="eyebrow">Mission Control</div>
            <h1>{title}</h1>
          </div>
          <p>{subtitle}</p>
        </section>
        {children}
      </main>
    </div>
  );
}
