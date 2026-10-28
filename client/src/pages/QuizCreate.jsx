import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, qs } from '../services/api';

export default function QuizCreate() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [subject, setSubject] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/questions${qs({ subject })}`)
      .then((data) => setQuestions(data.questions))
      .catch((err) => setError(err.message));
  }, [subject]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const timeLimitMinutes = Number(minutes);
    if (!title.trim()) return setError('Enter a title');
    if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 300) {
      return setError('Time limit must be a whole number of minutes between 1 and 300');
    }
    if (selected.length === 0) return setError('Select at least one question');
    setBusy(true);
    try {
      await api('/quizzes', { method: 'POST', body: { title: title.trim(), questionIds: selected, timeLimitMinutes } });
      navigate('/quizzes');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1>Create a quiz</h1>
      <div className="card">
        <div className="row">
          <div>
            <label htmlFor="quiz-title">Title</label>
            <input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="quiz-minutes">Time limit (minutes)</label>
            <input id="quiz-minutes" type="number" min="1" max="300" value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Pick questions from the bank ({selected.length} selected)</h2>
        <label htmlFor="quiz-subject">Filter by subject</label>
        <input id="quiz-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Exact subject name" />
        {questions.length === 0 ? (
          <p className="muted">No questions found. Add some in the Question Bank first.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {questions.map((q) => (
              <li key={q.id}>
                <label className="option">
                  <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                  <span>
                    {q.text} <span className="muted">({q.subject} / {q.topic} / {q.difficulty})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create quiz'}</button>
    </form>
  );
}
