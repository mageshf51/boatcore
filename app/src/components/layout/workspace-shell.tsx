'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Anchor,
  Users,
  HandCoins,
  LayoutDashboard,
  Ship,
  Receipt,
  Wallet,
  Calculator,
  Files,
  MessageCircle,
  History,
  Settings,
  LogOut,
  Menu,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  X,
} from 'lucide-react';
import { useWorkspace } from '../providers/workspace-provider';
import { usePreferences } from '../../stores/preferences-store';
import { useT } from '../../lib/translations';
import { api } from '../../lib/api-client';
import { LoginScreen } from '../../features/auth/login-screen';
const navigation = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Trips', '/trips', Ship],
  ['Quick Sales', '/sales', Receipt],
  ['Expenses', '/expenses', Wallet],
  ['Trip Settlement', '/settlement', Calculator],
  ['Crew', '/crew', Users],
  ['Dues & Payables', '/dues-payables', HandCoins],
  ['Trip Details', '/trip-details', Files],
  ['Team Chat', '/chat', MessageCircle],
  ['Change History', '/history', History],
  ['Masters & Settings', '/settings', Settings],
] as const;
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { data, loading, error, refresh } = useWorkspace(),
    path = usePathname(),
    router = useRouter(),
    t = useT();
  const { language, setLanguage, sidebarOpen, toggleSidebar } = usePreferences();
  if (loading)
    return (
      <div className="center-screen">
        <Anchor className="loading-anchor" />
        <p>{t('Loading workspace…')}</p>
      </div>
    );
  if (error)
    return (
      <div className="center-screen">
        <h2>{t('Something went wrong')}</h2>
        <p>{error}</p>
        <button className="button" onClick={() => void refresh()}>
          {t('Retry')}
        </button>
      </div>
    );
  if (!data) return <LoginScreen />;
  const current = navigation.find(([, href]) => path.startsWith(href))?.[0] || 'Dashboard';
  return (
    <div className="workspace">
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        aria-label={t('Close')}
        onClick={toggleSidebar}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link className="brand" href="/dashboard">
          <span className="brand-icon">
            <Anchor size={25} />
          </span>
          <span>
            boatcore<span className="brand-dot">.</span>
            <small>FISHING OPERATIONS</small>
          </span>
        </Link>
        <div className="sidebar-section">WORKSPACE</div>
        <nav>
          {navigation.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={current === label ? 'nav-item selected' : 'nav-item'}
              onClick={() => {
                if (sidebarOpen) toggleSidebar();
              }}
            >
              <Icon size={18} />
              <span>{t(label)}</span>
              {current === label && <ChevronRight size={15} />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sea-card">
            <Ship size={25} />
            <strong>{t('Connected operations')}</strong>
            <p>One boat. Every detail.</p>
          </div>
          <button
            onClick={async () => {
              await api('/auth/logout', { method: 'POST' });
              await refresh();
              router.push('/');
            }}
            className="nav-item logout"
          >
            <LogOut size={18} />
            {t('Sign out')}
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button mobile-menu" aria-label="Menu" onClick={toggleSidebar}>
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{t(current)}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="language-switch"
              onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
              aria-label="English / தமிழ்"
            >
              {language === 'en' ? 'EN / தமிழ்' : 'தமிழ் / EN'}
            </button>
            {data.user.role === 'guest' && (
              <span className="badge guest">
                <ShieldCheck size={13} />
                {t('Read only')}
              </span>
            )}
            <span className="avatar">{data.user.name.slice(0, 1)}</span>
            <div className="user-info">
              <strong>{data.user.name}</strong>
              <small>{data.user.role}</small>
            </div>
          </div>
        </header>
        <main className="page-content">
          {data.mode === 'demo' && (
            <div className="demo-strip">
              <span className="status-dot" />
              {t('Fictional portfolio demo')}
              <span className="strip-caption">{t('Read-only employer review')}</span>
            </div>
          )}
          {children}
        </main>
        <footer>
          BoatCore <span>·</span> Purpose-built for life at sea.
        </footer>
      </div>
    </div>
  );
}
