
const express = require('express');
const QuizAttempt = require('../models/QuizAttempt');
const Quiz = require('../models/Quiz');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);
router.use(authorize('student'));

// CSMQP-F-040: Student dashboard analytics
router.get('/student', async (req, res) => {
  // Only retrieve the logged-in student's attempts.
  const attempts = await QuizAttempt.find({
    student: req.user._id,
    status: 'submitted',
  }).sort({ submittedAt: -1 });

  // 1. Total quizzes taken
  const quizzesTaken = attempts.length;

  // 2. Overall average percentage based on all questions attempted
  const totalScore = attempts.reduce(
    (sum, attempt) => sum + attempt.score,
    0
  );

  const totalQuestions = attempts.reduce(
    (sum, attempt) => sum + attempt.total,
    0
  );

  const averageScore = totalQuestions
    ? Math.round((totalScore / totalQuestions) * 100)
    : 0;

  // 3. Retrieve quiz titles
  const quizIds = [
    ...new Set(attempts.map((attempt) => String(attempt.quiz))),
  ];

  const quizzes = await Quiz.find({
    _id: { $in: quizIds },
  }).select('title');

  const quizTitles = new Map(
    quizzes.map((quiz) => [String(quiz._id), quiz.title])
  );

  // 4. Last five quiz results
  const recentResults = attempts.slice(0, 5).map((attempt) => ({
    attemptId: String(attempt._id),
    quizTitle: quizTitles.get(String(attempt.quiz)) || 'Quiz',
    score: attempt.score,
    total: attempt.total,
    percentage: attempt.total
      ? Math.round((attempt.score / attempt.total) * 100)
      : 0,
    submittedAt: attempt.submittedAt,
  }));

  // 5. Calculate accuracy for each topic
  const topicStats = new Map();

  for (const attempt of attempts) {
    for (const question of attempt.graded) {
      const topic = question.topic || 'Uncategorized';

      if (!topicStats.has(topic)) {
        topicStats.set(topic, {
          correct: 0,
          total: 0,
        });
      }

      const stats = topicStats.get(topic);

      stats.total += 1;

      if (question.correct) {
        stats.correct += 1;
      }
    }
  }

  // Topics with accuracy below 60% are weak topics.
  const weakTopics = [...topicStats.entries()]
    .map(([topic, stats]) => ({
      topic,
      accuracy: Math.round(
        (stats.correct / stats.total) * 100
      ),
      questionsAttempted: stats.total,
    }))
    .filter((item) => item.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy);

  res.json({
    quizzesTaken,
    averageScore,
    recentResults,
    weakTopics,
  });
});

module.exports = router;
