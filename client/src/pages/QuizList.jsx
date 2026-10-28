import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function QuizList() {
  const { user } = useAuth();
  const isInstructor = user.role === 'instructor';
  const [quizzes, setQuizzes] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/quizzes')
      .then((data) => setQuizzes(data.quizzes))
      .catch((err) => setError(err.message));
  }, []);

  async function publish(quiz) {
    setError('');
    setMessage('');
    try {
      const { quiz: updated } = await api(`/quizzes/${quiz.id}/publish`, { method: 'POST' });
      setQuizzes((list) => list.map((q) => (q.id === quiz.id ? { ...q, ...updated } : q)));
      setMessage(`"${quiz.title}" is now published`);
    } catch (err) {
      setError(err.message);
    }
  }

  function studentAction(q) {
    if (!q.attempt) return <Link className="btn small" to={`/quizzes/${q.id}/attempt`}>Start</Link>;
    if (q.attempt.status === 'submitted') return <Link className="btn small secondary" to={`/attempts/${q.attempt.id}`}>View result</Link>;
    if (q.attempt.status === 'in_progress') return <Link className="btn small" to={`/quizzes/${q.id}/attempt`}>Resume</Link>;
    return <span className="muted">Time expired</span>;
  }

  return (
    <div>
      <h1>{isInstructor ? 'My quizzes' : 'Available quizzes'}</h1>
      {isInstructor && <Link className="btn" to="/quizzes/new">Create a quiz</Link>}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <div className="card">
        {quizzes === null && !error ? (
          <p>Loading...</p>
        ) : !quizzes || quizzes.length === 0 ? (
          <p className="muted">{isInstructor ? 'You have not created any quizzes yet.' : 'No quizzes are available right now.'}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th><th>Questions</th><th>Time limit</th><th>{isInstructor ? 'Status' : 'Your score'}</th><th />
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td>{q.questionCount}</td>
                  <td>{q.timeLimitMinutes} min</td>
                  <td>
                    {isInstructor ? (
                      <span className="badge">{q.published ? 'Published' : 'Draft'}</span>
                    ) : q.attempt?.status === 'submitted' ? (
                      `${q.attempt.score}/${q.attempt.total}`
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    {isInstructor
                      ? !q.published && <button className="btn small" type="button" onClick={() => publish(q)}>Publish</button>
                      : studentAction(q)}
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
