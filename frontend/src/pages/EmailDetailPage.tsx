import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { EmailDetail } from '../types/api';

const EmailDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    api.getEmail(id)
      .then((result) => { if (active) setEmail(result); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load this email');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <Link to="/dashboard" className="mb-6 inline-flex text-sm text-gray-400 hover:text-cyan-200">← Back to mailbox</Link>
      {loading ? <p className="py-12 text-gray-400">Loading email…</p> : error ? <div role="alert" className="rounded-md border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{error}</div> : email && <>
        <header className="border-b border-gray-800 pb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className={`rounded px-2 py-1 text-xs ${email.status === 'SENT' ? 'bg-emerald-950 text-emerald-300' : email.status === 'FAILED' ? 'bg-rose-950 text-rose-300' : 'bg-cyan-950 text-cyan-200'}`}>{email.status.toLowerCase()}</span>
            {email.previewUrl && <a href={email.previewUrl} target="_blank" rel="noreferrer" className="rounded-md border border-cyan-800 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-950">Open Ethereal preview ↗</a>}
          </div>
          <h1 className="text-2xl font-semibold text-white">{email.subject}</h1>
          <p className="mt-3 text-sm text-gray-400">To <span className="text-gray-200">{email.recipient}</span></p>
        </header>
        <dl className="grid gap-5 border-b border-gray-800 py-5 sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-gray-500">Scheduled</dt><dd className="mt-1 text-sm text-gray-200">{date(email.scheduledAt)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-gray-500">Sent</dt><dd className="mt-1 text-sm text-gray-200">{date(email.sentAt)}</dd></div>
        </dl>
        {email.error && <div role="alert" className="mt-5 rounded-md border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{email.error}</div>}
      </>}
    </div>
  );
};

export default EmailDetailPage;
