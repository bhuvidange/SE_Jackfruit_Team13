
function parseBody(response) {
  if (!response || !response.body) {
    throw new Error("The API returned an empty response.");
  }

  return typeof response.body === "string"
    ? JSON.parse(response.body)
    : response.body;
}

// Save authentication token after login
function saveLogin(requestParams, response, context, events, next) {
  try {
    const data = parseBody(response);

    if (!data.token) {
      console.log(
        "LOGIN FAILED:",
        "HTTP Status:",
        response.statusCode,
        "Response:",
        JSON.stringify(data)
      );

      console.log(
        "Account:",
        context.vars.email || "Email unavailable"
      );

      return next(
        new Error(`Login failed with HTTP ${response.statusCode}`)
      );
    }

    context.vars.token = data.token;

    console.log(
      `LOGIN SUCCESS: ${context.vars.email || "Student"}`
    );

    return next();
  } catch (error) {
    return next(error);
  }
}

// Find the dedicated load-test quiz
function saveQuiz(requestParams, response, context, events, next) {
  try {
    const data = parseBody(response);

    if (!data.quizzes || data.quizzes.length === 0) {
      throw new Error("No quizzes returned by the API.");
    }

    const quiz = data.quizzes.find(
      item => item.title === "LOAD TEST - Dedicated Quiz"
    );

    if (!quiz) {
      throw new Error("Dedicated load-test quiz was not found.");
    }

    context.vars.quizId = quiz.id;

    return next();
  } catch (error) {
    return next(error);
  }
}

// Save attempt ID and question IDs
function saveStartedQuiz(requestParams, response, context, events, next) {
  try {
    const data = parseBody(response);

    if (!data.attempt || !data.quiz || !data.quiz.questions) {
      throw new Error("Quiz start response is incomplete.");
    }

    context.vars.attemptId = data.attempt.id;

    context.vars.questionIds = data.quiz.questions.map(
      question => question.id
    );

    if (context.vars.questionIds.length === 0) {
      throw new Error("The load-test quiz contains no questions.");
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

// Prepare quiz submission
function prepareSubmit(requestParams, context, events, next) {
  const questionIds = context.vars.questionIds || [];

  if (questionIds.length === 0) {
    return next(new Error("No question IDs available for submission."));
  }

  requestParams.json = {
    answers: questionIds.map(questionId => ({
      questionId,
      selected: 0
    }))
  };

  context.vars.gradingStartedAt = Date.now();

  return next();
}

// Record grading performance
function recordGradingTime(requestParams, response, context, events, next) {
  const startedAt = context.vars.gradingStartedAt;

  if (startedAt) {
    const duration = Date.now() - startedAt;

    events.emit("histogram", "grading.duration_ms", duration);
    events.emit("counter", "grading.submissions", 1);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      events.emit("counter", "grading.success", 1);
    } else {
      events.emit("counter", "grading.failure", 1);

      console.log(
        "SUBMISSION FAILED:",
        response.statusCode,
        response.body
      );
    }
  }

  return next();
}

module.exports = {
  saveLogin,
  saveQuiz,
  saveStartedQuiz,
  prepareSubmit,
  recordGradingTime
};
