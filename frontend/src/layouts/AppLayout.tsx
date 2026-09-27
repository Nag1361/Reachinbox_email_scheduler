import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../services/AuthContext';
import type { SlackStatus } from '../types/api';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedMailbox = new URLSearchParams(location.search).get('mailbox') ?? 'scheduled';
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [slackError, setSlackError] = useState('');
  const [slackBusy, setSlackBusy] = useState(false);

  const loadSlack = async () => {
    try {
      setSlack(await api.getSlackStatus());
      setSlackError('');
    } catch (error) {
      setSlackError(error instanceof Error ? error.message : 'Could not load Slack status');
    }
  };

  useEffect(() => {
    void loadSlack();
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack')) {
      if (params.get('slack') === 'error') setSlackError('Slack connection was not completed.');
      navigate(window.location.pathname, { replace: true });
    }
  }, []);

  const toggleSlack = async () => {
    setSlackBusy(true);
    setSlackError('');
    if (slack?.connected) {
      try {
        await api.disconnectSlack();
        await loadSlack();
      } catch (error) {
        setSlackError(error instanceof Error ? error.message : 'Could not disconnect Slack');
      } finally {
        setSlackBusy(false);
      }
      return;
    }
    window.location.assign('/api/slack/connect');
  };

  const logout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      setSlackError(error instanceof Error ? error.message : 'Could not log out');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 md:flex">
      <aside className="flex w-full flex-col border-b border-gray-800 bg-gray-900 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-5">
          <div className="grid size-9 place-items-center rounded-lg bg-cyan-400 font-bold text-gray-950">R</div>
          <span className="text-lg font-semibold tracking-tight">ReachInbox</span>
        </div>
        <nav className="flex gap-2 p-3 md:flex-1 md:flex-col">
          <Link to="/dashboard?mailbox=scheduled" className={`rounded-md px-3 py-2 text-sm ${location.pathname === '/dashboard' && selectedMailbox === 'scheduled' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            Scheduled
          </Link>
          <Link to="/dashboard?mailbox=sent" className={`rounded-md px-3 py-2 text-sm ${location.pathname === '/dashboard' && selectedMailbox === 'sent' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            Sent
          </Link>
          <NavLink to="/compose" className={({ isActive }) => `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            Compose
          </NavLink>
          <button type="button" onClick={() => void toggleSlack()} disabled={slackBusy} className="rounded-md px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50">
            {slackBusy ? 'Updating Slack…' : slack?.connected ? 'Disconnect Slack' : 'Connect Slack'}
          </button>
          {slack?.connected && <span className="px-3 text-xs text-emerald-400">Connected{slack.connections[0]?.teamName ? ` · ${slack.connections[0].teamName}` : ''}</span>}
          {slackError && <p role="alert" className="px-3 text-xs text-rose-300">{slackError}</p>}
        </nav>
        <div className="flex items-center gap-3 border-t border-gray-800 p-4">
          {user?.avatar ? <img src={user.avatar} alt="" className="size-9 rounded-full object-cover" /> : <div className="grid size-9 place-items-center rounded-full bg-gray-700 text-sm">{user?.name?.slice(0, 1) ?? user?.email.slice(0, 1)}</div>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name || user?.email}</p>
            <p className="truncate text-xs text-gray-400">{user?.email}</p>
          </div>
          <button type="button" onClick={() => void logout()} title="Log out" aria-label="Log out" className="rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white">↪</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}