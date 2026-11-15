
const express = require('express');
const mongoose = require('mongoose');
const QuizAttempt = require('../models/QuizAttempt');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const HttpError = require('../utils/httpError');

const router = express.Router();

router.use(authenticate);

// CSMQP-F-040: Student dashboard analytics
router.get('/student', authorize('student'), async (req, res) => {
  const attempts = await QuizAttempt.find({
    student: req.user._id,
    status: 'submitted',
  }).sort({ submittedAt: -1 });

  const quizzesTaken = attempts.length;
  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const totalQuestions = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const averageScore = totalQuestions
    ? Math.round((totalScore / totalQuestions) * 100)
    : 0;

  const quizIds = [...new Set(attempts.map((attempt) => String(attempt.quiz)))];
  const quizzes = await Quiz.find({ _id: { $in: quizIds } }).select('title');
  const quizTitles = new Map(quizzes.map((quiz) => [String(quiz._id), quiz.title]));

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

  const topicStats = new Map();
  for (const attempt of attempts) {
    for (const question of attempt.graded) {
      const topic = question.topic || 'Uncategorized';
      if (!topicStats.has(topic)) topicStats.set(topic, { correct: 0, total: 0 });
      const stats = topicStats.get(topic);
      stats.total += 1;
      if (question.correct) stats.correct += 1;
    }
  }

  const weakTopics = [...topicStats.entries()]
    .map(([topic, stats]) => ({
      topic,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      questionsAttempted: stats.total,
    }))
    .filter((item) => item.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy);

  res.json({ quizzesTaken, averageScore, recentResults, weakTopics });
});

// CSMQP-F-041: List quizzes created by the logged-in instructor
router.get('/instructor/quizzes', authorize('instructor'), async (req, res) => {
  const quizzes = await Quiz.find({ instructor: req.user._id })
    .select('title questions published createdAt')
    .sort({ createdAt: -1 });

  res.json({
    quizzes: quizzes.map((quiz) => ({
      id: String(quiz._id),
      title: quiz.title,
      questionCount: quiz.questions.length,
      published: quiz.published,
      createdAt: quiz.createdAt,
    })),
  });
});

// CSMQP-F-041 and F-042: Analytics for one instructor-owned quiz
router.get(
  '/instructor/quizzes/:quizId',
  authorize('instructor'),
  async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.quizId)) {
      throw new HttpError(400, 'Invalid quiz ID');
    }

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      throw new HttpError(404, 'Quiz not found');
    }

    // An instructor can only view analytics for their own quizzes.
    if (String(quiz.instructor) !== String(req.user._id)) {
      throw new HttpError(403, 'You can only view analytics for your own quizzes');
    }

    const attempts = await QuizAttempt.find({
      quiz: quiz._id,
      status: 'submitted',
    }).sort({ submittedAt: -1 });

    // Calculate each attempt's percentage score.
    const percentages = attempts.map((attempt) =>
      attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0
    );

    const averageScore = percentages.length
      ? Math.round(percentages.reduce((sum, score) => sum + score, 0) / percentages.length)
      : 0;

    const highestScore = percentages.length ? Math.max(...percentages) : 0;
    const lowestScore = percentages.length ? Math.min(...percentages) : 0;

    // Score distribution for the chart.
    const scoreDistribution = [
      { label: '0–20%', min: 0, max: 20, count: 0 },
      { label: '21–40%', min: 21, max: 40, count: 0 },
      { label: '41–60%', min: 41, max: 60, count: 0 },
      { label: '61–80%', min: 61, max: 80, count: 0 },
      { label: '81–100%', min: 81, max: 100, count: 0 },
    ];

    percentages.forEach((percentage) => {
      const bucket = scoreDistribution.find(
        (item) => percentage >= item.min && percentage <= item.max
      );
      if (bucket) bucket.count += 1;
    });

    // Load question text for quizzes with no submitted attempts.
    const questions = await Question.find({
      _id: { $in: quiz.questions },
    }).select('text');

    const questionText = new Map(
      questions.map((question) => [String(question._id), question.text])
    );

    // Initialize question statistics in the quiz's original question order.
    const questionStats = new Map();

    quiz.questions.forEach((questionId) => {
      const id = String(questionId);
      questionStats.set(id, {
        questionId: id,
        text: questionText.get(id) || 'Question',
        correctCount: 0,
        totalResponses: 0,
      });
    });

    // Aggregate correctness using the saved graded snapshots.
    attempts.forEach((attempt) => {
      attempt.graded.forEach((graded) => {
        const id = String(graded.question);

        if (!questionStats.has(id)) {
          questionStats.set(id, {
            questionId: id,
            text: graded.text || 'Question',
            correctCount: 0,
            totalResponses: 0,
          });
        }

        const stats = questionStats.get(id);
        stats.text = graded.text || stats.text;
        stats.totalResponses += 1;

        if (graded.correct) {
          stats.correctCount += 1;
        }
      });
    });

    const perQuestion = [...questionStats.values()].map((question) => ({
      ...question,
      percentageCorrect: question.totalResponses
        ? Math.round((question.correctCount / question.totalResponses) * 100)
        : 0,
    }));

    res.json({
      quiz: {
        id: String(quiz._id),
        title: quiz.title,
        questionCount: quiz.questions.length,
      },
      attempts: attempts.length,
      averageScore,
      highestScore,
      lowestScore,
      scoreDistribution,
      perQuestion,
    });
  }
);

module.exports = router;
