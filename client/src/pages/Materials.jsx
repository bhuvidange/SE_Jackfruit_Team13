import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, downloadFile, qs } from '../services/api';

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.pptx,.jpg,.jpeg';
const EMPTY = { title: '', subject: '', topic: '', description: '' };

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function Materials() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (q) => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/materials${qs({ query: q })}`);
      setMaterials(data.materials);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const onSearch = (e) => {
    e.preventDefault();
    load(query.trim());
  };

  const onDownload = async (m) => {
    setError('');
    try {
      await downloadFile(`/materials/${m.id}/download`, m.originalName);
    } catch (err) {
      setError(err.message);
    }
  };

  async function onUpload(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!file) return setError('Choose a file to upload');
    if (file.size > MAX_BYTES) return setError('File is too large. The maximum size is 15 MB');
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => v && data.append(k, v));
    data.append('file', file);
    setUploading(true);
    try {
      await api('/materials', { method: 'POST', formData: data });
      setMessage('Material uploaded');
      setForm(EMPTY);
      setFile(null);
      setFileKey((k) => k + 1);
      load(query.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <h1>Study Materials</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {user.role === 'instructor' && (
        <form className="card" onSubmit={onUpload} aria-label="Upload material">
          <h2>Upload a material</h2>
          <div className="row">
            <div>
              <label htmlFor="m-title">Title</label>
              <input id="m-title" value={form.title} onChange={set('title')} required />
            </div>
            <div>
              <label htmlFor="m-subject">Subject</label>
              <input id="m-subject" value={form.subject} onChange={set('subject')} required />
            </div>
            <div>
              <label htmlFor="m-topic">Topic</label>
              <input id="m-topic" value={form.topic} onChange={set('topic')} required />
            </div>
          </div>
          <label htmlFor="m-desc">Description (optional)</label>
          <input id="m-desc" value={form.description} onChange={set('description')} />
          <label htmlFor="m-file">File (PDF, DOCX, PPTX or JPG, max 15 MB)</label>
          <input key={fileKey} id="m-file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files[0] || null)} />
          <button className="btn" type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>
      )}

      <form className="card" onSubmit={onSearch} role="search">
        <label htmlFor="search">Search by name or keyword</label>
        <div className="row">
          <input id="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. sorting" />
          <button className="btn" type="submit">Search</button>
        </div>
      </form>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : materials.length === 0 ? (
          <p className="muted">No materials found.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Title</th><th>Subject</th><th>Topic</th><th>Type</th><th>Size</th><th /></tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.title}
                    {m.description && <small>{m.description}</small>}
                  </td>
                  <td>{m.subject}</td>
                  <td>{m.topic}</td>
                  <td>{m.format.toUpperCase()}</td>
                  <td>{formatSize(m.size)}</td>
                  <td>
                    <button className="btn small" type="button" onClick={() => onDownload(m)} aria-label={`Download ${m.title}`}>Download</button>
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
