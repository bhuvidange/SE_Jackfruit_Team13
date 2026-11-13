import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

const summarize = (r) => {
  const t = r.targetSummary;
  if (!t) return 'Item no longer available';
  return r.targetType === 'material' ? `${t.title} (${t.subject})` : `${t.text} (${t.subject})`;
};

export default function AdminModeration() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api('/reports?status=open');
      setReports(data.reports);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(report, action, success) {
    setError('');
    setMessage('');
    try {
      await api(`/reports/${report.id}/${action}`, { method: 'PATCH' });
      setMessage(success);
    } catch (err) {
      setError(err.message);
    }
    await load();
  }

  const onRemove = (r) => {
    if (!window.confirm(`Remove this ${r.targetType}? It will be hidden from everyone.`)) return;
    return act(r, 'remove', `The ${r.targetType} was removed`);
  };

  const onDismiss = (r) => act(r, 'dismiss', 'Report dismissed');

  return (
    <div>
      <h1>Content Moderation</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : reports.length === 0 ? (
          <p className="muted">No open reports</p>
        ) : (
          <table>
            <thead>
              <tr><th>Type</th><th>Item</th><th>Reason</th><th>Reporter</th><th>Date</th><th /></tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.targetType}</td>
                  <td>{summarize(r)}</td>
                  <td>{r.reason}</td>
                  <td>{r.reporterName}</td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn small danger" type="button" onClick={() => onRemove(r)} aria-label={`Remove reported ${r.targetType}: ${summarize(r)}`}>Remove</button>
                    <button className="btn small" type="button" onClick={() => onDismiss(r)} aria-label={`Dismiss report on ${summarize(r)}`}>Dismiss</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
