import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';

export default function QuizResult() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/quizzes/attempts/${attemptId}`)
      .then((data) => setAttempt(data.attempt))
      .catch((err) => setError(err.message));
  }, [attemptId]);

  if (error) {
    return (
      <div className="card">
        <p className="error" role="alert">{error}</p>
        <Link to="/quizzes">Back to quizzes</Link>
      </div>
    );
  }
  if (!attempt) return <p>Loading result...</p>;

  return (
    <div>
      <h1>{attempt.quizTitle}</h1>
      <div className="card">
        <p>
          Score: <strong data-testid="score">{attempt.score} / {attempt.total}</strong> ({attempt.percentage}%)
        </p>
        {attempt.student && <p className="muted">Student: {attempt.student.name}</p>}
      </div>

      {attempt.results.map((r, i) => (
        <section key={r.questionId} className={`card result-q ${r.correct ? 'correct' : 'wrong'}`} aria-label={`Question ${i + 1}`}>
          <h2>
            Question {i + 1}: {r.correct ? <span className="correct">Correct</span> : <span className="wrong">Incorrect</span>}
          </h2>
          <p>{r.text}</p>
          <ul>
            {r.options.map((opt, idx) => (
              <li key={idx}>
                {opt}
                {idx === r.correctAnswer && <strong className="correct"> (correct answer)</strong>}
                {idx === r.selected && idx !== r.correctAnswer && <strong className="wrong"> (your answer)</strong>}
                {idx === r.selected && idx === r.correctAnswer && <strong className="correct"> (your answer)</strong>}
              </li>
            ))}
          </ul>
          {r.selected === null && <p className="muted">Not answered</p>}
        </section>
      ))}
      <Link className="btn" to="/quizzes">Back to quizzes</Link>
    </div>
  );
}
