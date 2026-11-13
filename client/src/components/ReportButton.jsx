import { useId, useState } from 'react';
import { api } from '../services/api';

/** "Report" button that opens a small inline form (CSMQP-F-051). `targetType` is 'material' or 'question'. */
export default function ReportButton({ targetType, targetId, label = 'Report' }) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit() {
    setError('');
    if (!reason.trim()) return setError('Please tell us why you are reporting this');
    setSending(true);
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason: reason.trim() } });
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (done) return <span className="muted" role="status">Reported - thank you</span>;

  if (!open) {
    return (
      <>
        <button className="btn small" type="button" onClick={() => setOpen(true)} aria-label={`${label} this ${targetType}`}>{label}</button>
        {error && <span className="error" role="alert">{error}</span>}
      </>
    );
  }

  return (
    // Not a <form>: this component is also rendered inside the quiz form, and forms cannot be nested.
    <div role="group" aria-label={`Report this ${targetType}`}>
      <label htmlFor={fieldId}>Why are you reporting this?</label>
      <textarea id={fieldId} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn small danger" type="button" onClick={onSubmit} disabled={sending}>{sending ? 'Sending...' : 'Send report'}</button>
      <button className="btn small" type="button" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
    </div>
  );
}
