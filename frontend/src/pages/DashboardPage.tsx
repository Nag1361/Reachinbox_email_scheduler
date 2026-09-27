import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Email, SearchResult } from '../types/api';

type Mailbox = 'scheduled' | 'sent';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const DashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mailboxParam = searchParams.get('mailbox');
  const mailbox: Mailbox = mailboxParam === 'sent' ? 'sent' : 'scheduled';
  const [emails, setEmails] = useState<Email[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult['data'] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const loadEmails = async (selected: Mailbox) => {
    setLoading(true);
    setError('');
    setSearchResults(null);
    try {
      setEmails(await api.getEmails(selected));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load emails');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmails(mailbox);
  }, [mailbox]);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      await loadEmails(mailbox);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const result = await api.searchEmails(query.trim());
      setSearchResults(result.data);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search is unavailable');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const shownEmails = searchResults ?? emails;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">Mailbox</p>
          <h1 className="text-2xl font-semibold text-white">Email activity</h1>
        </div>
        <Link to="/compose" className="rounded-md bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-gray-950 hover:bg-cyan-200">Compose email</Link>
      </header>

      <form onSubmit={search} className="mb-6 flex max-w-2xl gap-2">
        <label className="sr-only" htmlFor="email-search">Search emails</label>
        <input id="email-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sender, recipient, subject, or body" className="min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-cyan-300" />
        <button type="submit" disabled={searching} className="rounded-md border border-gray-700 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50">{searching ? 'Searching…' : 'Search'}</button>
        {searchResults && <button type="button" onClick={() => { setQuery(''); void loadEmails(mailbox); }} className="rounded-md px-3 text-sm text-gray-400 hover:text-white">Clear</button>}
      </form>

      <div className="mb-4 flex border-b border-gray-800" role="tablist" aria-label="Email status">
        {(['scheduled', 'sent'] as const).map((tab) => (
          <button key={tab} type="button" role="tab" aria-selected={mailbox === tab} onClick={() => { setSearchParams({ mailbox: tab }); setQuery(''); }} className={`border-b-2 px-4 py-3 text-sm capitalize ${mailbox === tab ? 'border-cyan-300 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {tab}
          </button>
        ))}
        {searchResults && <span className="ml-auto self-center text-xs text-gray-500">Search results</span>}
      </div>

      {error && <div role="alert" className="mb-4 rounded-md border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/60">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-3 font-medium">Recipient</th><th className="px-4 py-3 font-medium">Subject</th><th className="px-4 py-3 font-medium">{mailbox === 'sent' ? 'Sent time' : 'Scheduled time'}</th><th className="px-4 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading || searching ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">{searching ? 'Searching emails…' : 'Loading emails…'}</td></tr>
            ) : shownEmails.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">{error ? 'Email data could not be loaded.' : searchResults ? 'No matching emails.' : `No ${mailbox} emails yet.`}</td></tr>
            ) : shownEmails.map((email) => (
              <tr key={email.id} className="hover:bg-gray-800/60">
                <td className="px-4 py-4"><Link to={`/email/${email.id}`} className="text-gray-200 hover:text-cyan-200">{email.recipientEmail}</Link></td>
                <td className="max-w-sm truncate px-4 py-4 text-gray-300">{email.subject}</td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-400">{formatDate(mailbox === 'sent' ? email.sentAt : email.scheduledAt)}</td>
                <td className="px-4 py-4"><span className={`rounded px-2 py-1 text-xs ${email.status === 'SENT' ? 'bg-emerald-950 text-emerald-300' : email.status === 'FAILED' ? 'bg-rose-950 text-rose-300' : 'bg-cyan-950 text-cyan-200'}`}>{email.status.toLowerCase()}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;
