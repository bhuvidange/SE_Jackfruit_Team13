import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';

export const formatClock = (seconds) => {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Student quiz screen: server-fixed deadline, visible countdown, auto-submit when time runs out (CSMQP-F-031/033). */
export default function QuizAttempt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const deadline = useRef(null);
  const sent = useRef(false);
  const answersRef = useRef({});
  answersRef.current = answers;

  useEffect(() => {
    let active = true;
    api(`/quizzes/${id}/start`, { method: 'POST' })
      .then((res) => {
        if (!active) return;
        // Convert the server deadline into this device's clock so a wrong local clock cannot skew the timer.
        const offset = Date.parse(res.serverTime) - Date.now();
        deadline.current = Date.parse(res.attempt.expiresAt) - offset;
        setSecondsLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
        setData(res);
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 409 && err.data?.attemptId && /submitted/i.test(err.message)) {
          navigate(`/attempts/${err.data.attemptId}`, { replace: true });
        } else {
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);

  const submit = useCallback(
    async (auto = false) => {
      if (sent.current || !data) return;
      sent.current = true;
      setSubmitting(true);
      setError('');
      try {
        const payload = data.quiz.questions.map((q) => ({ questionId: q.id, selected: answersRef.current[q.id] ?? null }));
        const res = await api(`/quizzes/${id}/submit`, { method: 'POST', body: { answers: payload } });
        navigate(`/attempts/${res.attempt.id}`, { replace: true });
      } catch (err) {
        setError(auto ? `Time is up. ${err.message}` : err.message);
        setSubmitting(false);
        if (err.status !== 400 && err.status !== 409) sent.current = false; // allow retry after network errors
      }
    },
    [data, id, navigate]
  );

  useEffect(() => {
    if (!data) return undefined;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        submit(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [data, submit]);

  if (error && !data) {
    return (
      <div className="card">
        <p className="error" role="alert">{error}</p>
        <Link to="/quizzes">Back to quizzes</Link>
      </div>
    );
  }
  if (!data) return <p>Loading quiz...</p>;

  const { quiz } = data;
  const answered = Object.keys(answers).length;

  return (
    <div>
      <div className="card" style={{ position: 'sticky', top: 0 }}>
        <h1>{quiz.title}</h1>
        <p>
          Time left: <span className={`timer${secondsLeft <= 60 ? ' low' : ''}`} role="timer" aria-label="Time left">{formatClock(secondsLeft)}</span>
          {' '}
          <span className="muted">({answered}/{quiz.questions.length} answered)</span>
        </p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        {quiz.questions.map((q, i) => (
          <fieldset key={q.id} className="card">
            <legend>Question {i + 1}</legend>
            <p>{q.text}</p>
            {q.options.map((opt, idx) => (
              <label key={idx} className="option">
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === idx}
                  onChange={() => setAnswers({ ...answers, [q.id]: idx })}
                />
                {opt}
              </label>
            ))}
          </fieldset>
        ))}
        <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit quiz'}</button>
      </form>
    </div>
  );
}
