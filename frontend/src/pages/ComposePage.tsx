import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../services/AuthContext';

const EMAIL_PATTERN = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;
const EMAIL_VALIDATION = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function collectAddresses(text: string): string[] {
  return [...new Set((text.match(EMAIL_PATTERN) ?? []).map((email) => email.toLowerCase()))]
    .filter((email) => EMAIL_VALIDATION.test(email));
}

function parseCsv(text: string): string[] {
  const rows = text.split(/\r?\n/).filter((row) => row.trim());
  if (rows.length === 0) return [];
  const cells = rows.map((row) => row.match(/("(?:[^"]|"")*"|[^,;\t]+)/g)?.map((cell) => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')) ?? []);
  const headerIndex = cells[0].findIndex((cell) => /e-?mail/i.test(cell));
  const values = headerIndex >= 0
    ? cells.slice(1).map((row) => row[headerIndex] ?? '').join('\n')
    : cells.flat().join('\n');
  return collectAddresses(values);
}

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const ComposePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [senderEmail, setSenderEmail] = useState(user?.email ?? '');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [startTime, setStartTime] = useState(localDateTime(new Date(Date.now() + 60_000)));
  const [showSendLater, setShowSendLater] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const recipientCount = [...new Set([...recipients, ...collectAddresses(recipientInput)])].length;

  const addManualRecipients = () => {
    const next = collectAddresses(recipientInput);
    if (next.length) {
      setRecipients((current) => [...new Set([...current, ...next])]);
      setRecipientInput('');
    }
  };

  const importRecipients = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Choose a .csv or .txt recipient file.');
      return;
    }
    try {
      const text = await file.text();
      const extracted = file.name.toLowerCase().endsWith('.csv') ? parseCsv(text) : collectAddresses(text);
      setRecipients((current) => [...new Set([...current, ...extracted])]);
      setError(extracted.length ? '' : 'No valid email addresses were found in that file.');
    } catch {
      setError('Could not read that recipient file.');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setToast('');
    const allRecipients = [...new Set([...recipients, ...collectAddresses(recipientInput)])];
    if (allRecipients.length === 0) {
      setError('Add at least one valid recipient email address.');
      return;
    }
    if (!senderEmail.trim() || !subject.trim() || !body.trim()) {
      setError('From, subject, and body are required.');
      return;
    }
    const scheduledDate = new Date(startTime);
    if (Number.isNaN(scheduledDate.getTime())) {
      setError('Choose a valid start time.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.scheduleEmail({
        senderEmail: senderEmail.trim(),
        recipients: allRecipients,
        subject: subject.trim(),
        body,
        startTime: scheduledDate.toISOString(),
        delayBetweenEmails: Math.max(0, delayBetweenEmails),
        hourlyLimit: Math.max(1, hourlyLimit),
      });
      setToast(`${result.scheduled} email${result.scheduled === 1 ? '' : 's'} scheduled successfully.`);
      setRecipients([]);
      setRecipientInput('');
      setSubject('');
      setBody('');
      setShowSendLater(false);
      window.setTimeout(() => navigate('/dashboard'), 700);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not schedule emails.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <header className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">New message</p>
        <h1 className="text-2xl font-semibold text-white">Compose email</h1>
      </header>
      {error && <div role="alert" className="mb-4 rounded-md border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {toast && <div role="status" className="mb-4 rounded-md border border-emerald-900 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">{toast}</div>}

      <form onSubmit={submit} className="space-y-5">
        <label className="block text-sm text-gray-300">From
          <input type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} required className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-300" />
        </label>
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="recipient-list" className="text-sm text-gray-300">To</label>
            <span className="text-xs text-gray-400">{recipientCount} recipient{recipientCount === 1 ? '' : 's'}</span>
          </div>
          <textarea id="recipient-list" value={recipientInput} onChange={(event) => setRecipientInput(event.target.value)} placeholder="Enter addresses separated by commas or spaces" rows={3} className="w-full rounded-md border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-gray-500 focus:border-cyan-300" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={addManualRecipients} className="rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-200 hover:bg-gray-800">Add addresses</button>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-200 hover:bg-gray-800">Upload CSV/TXT</button>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={importRecipients} className="hidden" />
            {recipients.length > 0 && <button type="button" onClick={() => setRecipients([])} className="px-2 py-2 text-xs text-gray-400 hover:text-white">Clear recipients</button>}
          </div>
          {recipients.length > 0 && <p className="mt-2 break-words text-xs text-gray-500">{recipients.join(', ')}</p>}
        </section>
        <label className="block text-sm text-gray-300">Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={500} className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-300" />
        </label>
        <label className="block text-sm text-gray-300">Body
          <textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={9} className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-300" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-gray-300">Delay between emails (ms)
            <input type="number" min={0} value={delayBetweenEmails} onChange={(event) => setDelayBetweenEmails(Number(event.target.value))} className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-300" />
          </label>
          <label className="block text-sm text-gray-300">Hourly limit
            <input type="number" min={1} step={1} value={hourlyLimit} onChange={(event) => setHourlyLimit(Number(event.target.value))} className="mt-2 w-full rounded-md border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-300" />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-5">
          <button type="button" onClick={() => setShowSendLater(true)} className="rounded-md border border-gray-700 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800">Send later · {new Date(startTime).toLocaleString()}</button>
          <button type="submit" disabled={loading || recipients.length + collectAddresses(recipientInput).length === 0 || !subject.trim() || !body.trim()} className="rounded-md bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-gray-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Scheduling…' : 'Schedule email'}</button>
        </div>
      </form>

      {showSendLater && <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSendLater(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="send-later-title" className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-2xl">
          <h2 id="send-later-title" className="mb-4 text-lg font-semibold text-white">Schedule delivery</h2>
          <label className="block text-sm text-gray-300">Start time
            <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-2 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2.5 text-white" />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setShowSendLater(false)} className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
            <button type="button" onClick={() => setShowSendLater(false)} className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-gray-950">Use this time</button>
          </div>
        </section>
      </div>}
    </div>
  );
};

export default ComposePage;
