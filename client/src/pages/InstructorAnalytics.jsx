
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import './InstructorAnalytics.css';

export default function InstructorAnalytics() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState('');

  // Load only the logged-in instructor's quizzes.
  useEffect(() => {
    api('/analytics/instructor/quizzes')
      .then((data) => {
        setQuizzes(data.quizzes);
        if (data.quizzes.length > 0) {
          setSelectedQuizId(data.quizzes[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingQuizzes(false));
  }, []);

  // Load analytics whenever the selected quiz changes.
  useEffect(() => {
    if (!selectedQuizId) {
      setAnalytics(null);
      return;
    }

    let cancelled = false;

    setLoadingAnalytics(true);
    setAnalytics(null);
    setError('');

    api(`/analytics/instructor/quizzes/${selectedQuizId}`)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingAnalytics(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedQuizId]);

  if (loadingQuizzes) {
    return (
      <main className="container instructor-analytics">
        <h1>Instructor Analytics</h1>
        <div className="card"><p>Loading your quizzes...</p></div>
      </main>
    );
  }

  return (
    <main className="container instructor-analytics">
      <div className="analytics-heading">
        <div>
          <h1>Instructor Analytics</h1>
          <p className="muted">
            Monitor quiz performance and understand student progress.
          </p>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {quizzes.length === 0 ? (
        <section className="card">
          <h2>No quizzes available</h2>
          <p className="muted">
            Create a quiz to start viewing instructor analytics.
          </p>
        </section>
      ) : (
        <>
          <section className="card analytics-selector">
            <label htmlFor="analytics-quiz">Select a quiz</label>
            <select
              id="analytics-quiz"
              value={selectedQuizId}
              onChange={(event) => setSelectedQuizId(event.target.value)}
            >
              {quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title}
                </option>
              ))}
            </select>
          </section>

          {loadingAnalytics ? (
            <div className="card">
              <p>Loading quiz analytics...</p>
            </div>
          ) : analytics ? (
            <>
              <div className="analytics-quiz-heading">
                <h2>{analytics.quiz.title}</h2>
                <span className="muted">
                  {analytics.quiz.questionCount} questions
                </span>
              </div>

              <section className="analytics-stats">
                <div className="card analytics-stat">
                  <p className="muted">Total Attempts</p>
                  <h2>{analytics.attempts}</h2>
                </div>

                <div className="card analytics-stat">
                  <p className="muted">Average Score</p>
                  <h2>{analytics.averageScore}%</h2>
                </div>

                <div className="card analytics-stat">
                  <p className="muted">Highest Score</p>
                  <h2>{analytics.highestScore}%</h2>
                </div>

                <div className="card analytics-stat">
                  <p className="muted">Lowest Score</p>
                  <h2>{analytics.lowestScore}%</h2>
                </div>
              </section>

              {analytics.attempts === 0 && (
                <p className="muted analytics-empty">
                  No students have submitted this quiz yet. Charts will update
                  when submissions are received.
                </p>
              )}

              <section className="card analytics-chart">
                <h2>Score Distribution</h2>
                <p className="muted">
                  Number of attempts in each score range.
                </p>
                <div className="analytics-chart-area">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name="Attempts"
                        fill="#2563eb"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card analytics-chart">
                <h2>Question-wise Correctness</h2>
                <p className="muted">
                  Percentage of students who answered each question correctly.
                </p>

                {analytics.perQuestion.length === 0 ? (
                  <p className="muted">No question data available.</p>
                ) : (
                  <div className="analytics-chart-area">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.perQuestion}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="questionId"
                          tickFormatter={(_, index) => `Q${index + 1}`}
                        />
                        <YAxis domain={[0, 100]} unit="%" />
                        <Tooltip
                          formatter={(value) => [`${value}%`, 'Correct']}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.text || 'Question'
                          }
                        />
                        <Bar
                          dataKey="percentageCorrect"
                          name="Correct answers"
                          fill="#16a34a"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <section className="card analytics-question-list">
                <h2>Question Performance Details</h2>
                {analytics.perQuestion.map((question, index) => (
                  <div className="analytics-question" key={question.questionId}>
                    <div>
                      <strong>Question {index + 1}</strong>
                      <p>{question.text}</p>
                      <small className="muted">
                        {question.correctCount} correct out of{' '}
                        {question.totalResponses} responses
                      </small>
                    </div>
                    <strong>{question.percentageCorrect}%</strong>
                  </div>
                ))}
              </section>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
