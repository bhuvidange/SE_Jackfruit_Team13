
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function StudentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/analytics/student')
      .then((data) => setDashboard(data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="container">
        <h1>Student Dashboard</h1>
        <p className="error" role="alert">{error}</p>
        <button
          className="btn"
          type="button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container">
        <h1>Student Dashboard</h1>
        <div className="card">
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const {
    quizzesTaken,
    averageScore,
    recentResults,
    weakTopics,
  } = dashboard;

  function formatDate(date) {
    if (!date) return '-';

    return new Date(date).toLocaleDateString();
  }

  return (
    <div className="container student-dashboard">
      <div className="dashboard-heading">
        <div>
          <h1>Student Dashboard</h1>
          <p className="muted">
            Track your quiz performance and identify areas to improve.
          </p>
        </div>
        <Link className="btn" to="/quizzes">
          Explore Quizzes
        </Link>
      </div>

      {/* Performance summary cards */}
      <div className="dashboard-stats">
        <div className="card dashboard-stat">
          <p className="muted">Quizzes Taken</p>
          <h2>{quizzesTaken}</h2>
          <span className="muted">Completed quizzes</span>
        </div>

        <div className="card dashboard-stat">
          <p className="muted">Average Score</p>
          <h2>{averageScore}%</h2>
          <span className="muted">Overall performance</span>
        </div>
      </div>

      {/* Recent quiz results */}
      <section className="card dashboard-section">
        <div className="section-heading">
          <h2>Recent Quiz Results</h2>
          <Link to="/quizzes">View quizzes</Link>
        </div>

        {recentResults.length === 0 ? (
          <p className="muted">
            You haven't completed any quizzes yet.
            Start a quiz to see your results here.
          </p>
        ) : (
          <div className="dashboard-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Submitted On</th>
                  <th>Result</th>
                </tr>
              </thead>

              <tbody>
                {recentResults.map((result) => (
                  <tr key={result.attemptId}>
                    <td>{result.quizTitle}</td>
                    <td>
                      {result.score}/{result.total}
                    </td>
                    <td>
                      <span
                        className={
                          result.percentage >= 60
                            ? 'dashboard-good'
                            : 'dashboard-low'
                        }
                      >
                        {result.percentage}%
                      </span>
                    </td>
                    <td>{formatDate(result.submittedAt)}</td>
                    <td>
                      <Link
                        className="btn small secondary"
                        to={`/attempts/${result.attemptId}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Weak topics */}
      <section className="card dashboard-section">
        <div className="section-heading">
          <h2>Topics to Improve</h2>
          <span className="badge">Below 60% accuracy</span>
        </div>

        {weakTopics.length === 0 ? (
          <p className="success">
            Great work! No weak topics identified from your completed quizzes.
          </p>
        ) : (
          <div className="weak-topics-list">
            {weakTopics.map((item) => (
              <div className="weak-topic" key={item.topic}>
                <div className="weak-topic-info">
                  <strong>{item.topic}</strong>
                  <span className="dashboard-low">
                    {item.accuracy}% accuracy
                  </span>
                </div>

                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${item.topic} accuracy`}
                  aria-valuenow={item.accuracy}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${item.accuracy}%` }}
                  />
                </div>

                <small className="muted">
                  {item.questionsAttempted} questions attempted
                </small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
