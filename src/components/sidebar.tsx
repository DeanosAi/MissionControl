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

function Navigation({ active, className = '' }: SidebarProps & { className?: string }) {
  const projectActive = active === 'projects';
  return (
    <nav className={`sidebar-nav ${className}`.trim()} aria-label="Primary">
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
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup">
      <Image src="/mission-control-logo.svg" alt="Mission Control logo" width={compact ? 42 : 56} height={compact ? 42 : 56} className="brand-mark" />
      <div>
        <div className="eyebrow">Mission Control</div>
        <h1 className="sidebar-title">AI Operating System</h1>
      </div>
    </div>
  );
}

export function Sidebar({ active }: SidebarProps) {
  return (
    <>
      <aside className="mc-sidebar">
        <div>
          <Brand />
          <p className="sidebar-copy">Conversational control for projects, ideas, builds, systems, automations, and permanent memory.</p>
        </div>

        <Navigation active={active} />

        <div className="sidebar-footer card muted-card">
          <div className="eyebrow">Operating mode</div>
          <p>Mission Control chooses the capabilities. Meaningful changes wait for your approval.</p>
          <form action={logout} className="logout-form">
            <button type="submit" className="logout-button">Sign out</button>
          </form>
        </div>
      </aside>

      <header className="mobile-topbar">
        <Brand compact />
        <details className="mobile-menu">
          <summary aria-label="Open navigation"><span>Menu</span></summary>
          <div className="mobile-menu-panel">
            <Navigation active={active} className="mobile-sidebar-nav" />
            <form action={logout} className="logout-form">
              <button type="submit" className="logout-button">Sign out</button>
            </form>
          </div>
        </details>
      </header>
    </>
  );
}
