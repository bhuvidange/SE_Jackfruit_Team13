
const path = require('path');

module.paths.push(
  path.resolve(__dirname, '../server/node_modules')
);

const mongoose = require('mongoose');
const Quiz = require('../server/src/models/Quiz');
const QuizAttempt = require('../server/src/models/QuizAttempt');

async function reset() {
  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.includes('csmqp_loadtest')) {
    throw new Error(
      'Refusing to reset a non-load-test database.'
    );
  }

  await mongoose.connect(uri);

  const quiz = await Quiz.findOne({
    title: 'LOAD TEST - Dedicated Quiz',
  });

  if (!quiz) {
    throw new Error('Dedicated load-test quiz not found.');
  }

  const result = await QuizAttempt.deleteMany({
    quiz: quiz._id,
  });

  console.log(`Deleted ${result.deletedCount} old quiz attempts.`);
  console.log('Load-test quiz is ready for a fresh run.');
}

reset()
  .catch((error) => {
    console.error('Reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
