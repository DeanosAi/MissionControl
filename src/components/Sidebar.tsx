import Image from 'next/image';
import Link from 'next/link';
import { navItems, type DashboardKey } from '@/lib/data';

async function logout() {
  'use server';

  const { clearAdminSession } = await import('@/lib/auth/session');
  await clearAdminSession();
}

interface SidebarProps {
  active: DashboardKey;
}

export function Sidebar({ active }: SidebarProps) {
  const projectActive = active === 'projects';

  return (
    <aside className="mc-sidebar">
      <div>
        <div className="brand-lockup">
          <Image src="/mission-control-logo.svg" alt="Mission Control logo" width={56} height={56} className="brand-mark" />
          <div>
            <div className="eyebrow">Mission Control</div>
            <h1 className="sidebar-title">Builder OS</h1>
          </div>
        </div>
        <p className="sidebar-copy">
          Private control center for ideas, projects, AI builds, systems, automations, and memory.
        </p>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        {navItems.map((item) => {
          if (item.key === 'projects') {
            return (
              <div key={item.key} className="sidebar-group">
                <Link href={item.href} className={`sidebar-link ${projectActive ? 'active' : ''}`}>
                  <span>{item.label}</span>
                  {item.badge ? <span className="sidebar-badge">{item.badge}</span> : null}
                </Link>
                <Link href="/projects/current-tasks" className={`sidebar-link sidebar-child-link ${projectActive ? 'active' : ''}`}>
                  <span>Current Tasks</span>
                </Link>
              </div>
            );
          }

          return (
            <Link key={item.key} href={item.href} className={`sidebar-link ${active === item.key ? 'active' : ''}`}>
              <span>{item.label}</span>
              {item.badge ? <span className="sidebar-badge">{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer card muted-card">
        <div className="eyebrow">Operating mode</div>
        <p>Single-user for now, modular by design, and ready for sharper auth and persistence later.</p>
        <form action={logout} className="logout-form">
          <button type="submit" className="logout-button">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
