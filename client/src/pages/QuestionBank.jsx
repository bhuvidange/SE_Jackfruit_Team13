import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, qs } from '../services/api';

const blank = () => ({ type: 'mcq', text: '', options: ['', '', '', ''], correctAnswer: 0, subject: '', topic: '', difficulty: 'easy' });
const NO_FILTERS = { subject: '', topic: '', difficulty: '', q: '' };

export default function QuestionBank() {
  const { user } = useAuth();
  const canEdit = user?.role === 'instructor';
  const [questions, setQuestions] = useState([]);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f) => {
    setLoading(true);
    try {
      const data = await api(`/questions${qs(f)}`);
      setQuestions(data.questions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(NO_FILTERS);
  }, [load]);

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function changeType(type) {
    setForm({ ...form, type, options: type === 'mcq' ? ['', '', '', ''] : ['True', 'False'], correctAnswer: 0 });
  }

  function setOption(i, value) {
    const options = [...form.options];
    options[i] = value;
    setForm({ ...form, options });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (form.type === 'mcq' && form.options.some((o) => !o.trim())) return setError('Fill in all four options');
    try {
      const body = { ...form, correctAnswer: Number(form.correctAnswer) };
      if (editingId) await api(`/questions/${editingId}`, { method: 'PUT', body });
      else await api('/questions', { method: 'POST', body });
      setMessage(editingId ? 'Question updated' : 'Question added');
      setForm(blank());
      setEditingId(null);
      load(filters);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(q) {
    setEditingId(q.id);
    setForm({ type: q.type, text: q.text, options: [...q.options], correctAnswer: q.correctAnswer, subject: q.subject, topic: q.topic, difficulty: q.difficulty });
    setMessage('');
    setError('');
  }

  async function onDelete(q) {
    if (!window.confirm('Delete this question?')) return;
    setError('');
    setMessage('');
    try {
      await api(`/questions/${q.id}`, { method: 'DELETE' });
      setMessage('Question deleted');
      load(filters);
    } catch (err) {
      setError(err.message);
    }
  }

  const onFilter = (e) => {
    e.preventDefault();
    load(filters);
  };
  const setFilter = (field) => (e) => setFilters({ ...filters, [field]: e.target.value });

  return (
    <div>
      <h1>Question Bank</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {canEdit && (
        <form className="card" onSubmit={onSubmit} aria-label="Question form">
          <h2>{editingId ? 'Edit question' : 'Add a question'}</h2>
          <div className="row">
            <div>
              <label htmlFor="q-type">Type</label>
              <select id="q-type" value={form.type} onChange={(e) => changeType(e.target.value)} disabled={Boolean(editingId)}>
                <option value="mcq">Multiple choice</option>
                <option value="tf">True / False</option>
              </select>
            </div>
            <div>
              <label htmlFor="q-difficulty">Difficulty</label>
              <select id="q-difficulty" value={form.difficulty} onChange={setField('difficulty')}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <label htmlFor="q-text">Question</label>
          <textarea id="q-text" rows={2} value={form.text} onChange={setField('text')} required />
          <fieldset>
            <legend>Options (select the correct one)</legend>
            {form.options.map((opt, i) => (
              <div key={i} className="option">
                <input
                  type="radio"
                  name="correct"
                  aria-label={`Option ${i + 1} is correct`}
                  checked={Number(form.correctAnswer) === i}
                  onChange={() => setForm({ ...form, correctAnswer: i })}
                />
                {form.type === 'tf' ? (
                  <span>{opt}</span>
                ) : (
                  <input aria-label={`Option ${i + 1}`} value={opt} onChange={(e) => setOption(i, e.target.value)} />
                )}
              </div>
            ))}
          </fieldset>
          <div className="row">
            <div>
              <label htmlFor="q-subject">Subject</label>
              <input id="q-subject" value={form.subject} onChange={setField('subject')} required />
            </div>
            <div>
              <label htmlFor="q-topic">Topic</label>
              <input id="q-topic" value={form.topic} onChange={setField('topic')} required />
            </div>
          </div>
          <button className="btn" type="submit">{editingId ? 'Save changes' : 'Add question'}</button>
          {editingId && (
            <button className="btn secondary" type="button" onClick={() => { setEditingId(null); setForm(blank()); }} style={{ marginLeft: '0.5rem' }}>
              Cancel
            </button>
          )}
        </form>
      )}

      <form className="card" onSubmit={onFilter} aria-label="Filter questions">
        <h2>Filter</h2>
        <div className="row">
          <div>
            <label htmlFor="f-subject">Subject</label>
            <input id="f-subject" value={filters.subject} onChange={setFilter('subject')} />
          </div>
          <div>
            <label htmlFor="f-topic">Topic</label>
            <input id="f-topic" value={filters.topic} onChange={setFilter('topic')} />
          </div>
          <div>
            <label htmlFor="f-difficulty">Difficulty</label>
            <select id="f-difficulty" value={filters.difficulty} onChange={setFilter('difficulty')}>
              <option value="">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-q">Text contains</label>
            <input id="f-q" value={filters.q} onChange={setFilter('q')} />
          </div>
        </div>
        <button className="btn" type="submit">Apply filters</button>
      </form>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : questions.length === 0 ? (
          <p className="muted">No questions found.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Question</th><th>Tags</th><th /></tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>
                    {q.text}
                    <small>
                      {q.options.map((o, i) => (i === q.correctAnswer ? `[${o}]` : o)).join(' / ')}
                    </small>
                  </td>
                  <td>
                    <span className="badge">{q.type === 'mcq' ? 'MCQ' : 'T/F'}</span> {q.subject} / {q.topic} / {q.difficulty}
                  </td>
                  <td>
                    {canEdit && q.owner === user.id && (
                      <>
                        <button className="btn small" type="button" onClick={() => startEdit(q)}>Edit</button>{' '}
                        <button className="btn small danger" type="button" onClick={() => onDelete(q)}>Delete</button>
                      </>
                    )}
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
