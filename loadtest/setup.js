
const path = require('path');

// Resolve dependencies installed in server/node_modules.
module.paths.push(
  path.resolve(__dirname, '../server/node_modules')
);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const config = require('../server/src/config');
const User = require('../server/src/models/User');
const Question = require('../server/src/models/Question');
const Quiz = require('../server/src/models/Quiz');
const QuizAttempt = require('../server/src/models/QuizAttempt');

const USER_COUNT = 500;
const PASSWORD = 'LoadTest@12345';
const INSTRUCTOR_EMAIL = 'loadtest-instructor@csmqp.test';
const QUIZ_TITLE = 'LOAD TEST - Dedicated Quiz';
const EMAIL_PREFIX = 'loadtest-student-';

async function setup() {
  // Safety check: never run this script against the normal database.
  if (!config.mongoUri.includes('csmqp_loadtest')) {
    throw new Error(
      'Safety check failed. MONGODB_URI must point to csmqp_loadtest.'
    );
  }

  await mongoose.connect(config.mongoUri);

  console.log('Connected to isolated load-test database.');

  const passwordHash = await bcrypt.hash(
    PASSWORD,
    config.bcryptRounds
  );

  // Create the dedicated instructor.
  let instructor = await User.findOne({
    email: INSTRUCTOR_EMAIL,
  });

  if (!instructor) {
    instructor = await User.create({
      name: 'Load Test Instructor',
      email: INSTRUCTOR_EMAIL,
      passwordHash,
      role: 'instructor',
      status: 'active',
    });
  }

  // Remove only the previous dedicated test quiz and its attempts.
  const oldQuiz = await Quiz.findOne({
    title: QUIZ_TITLE,
  });

  if (oldQuiz) {
    await QuizAttempt.deleteMany({
      quiz: oldQuiz._id,
    });

    await Quiz.deleteOne({
      _id: oldQuiz._id,
    });
  }

  // Remove only this instructor's previous LOADTEST questions.
  await Question.deleteMany({
    owner: instructor._id,
    text: /^LOADTEST:/,
  });

  // Five questions for the dedicated load-test quiz.
  const questionData = [
    {
      text: 'LOADTEST: What is the time complexity of binary search?',
      options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
      correctAnswer: 1,
      subject: 'Load Testing',
      topic: 'Algorithms',
      difficulty: 'easy',
    },
    {
      text: 'LOADTEST: Which data structure follows FIFO?',
      options: ['Stack', 'Queue', 'Tree', 'Graph'],
      correctAnswer: 1,
      subject: 'Load Testing',
      topic: 'Data Structures',
      difficulty: 'easy',
    },
    {
      text: 'LOADTEST: Which language runs natively in a browser?',
      options: ['C', 'Java', 'JavaScript', 'Python'],
      correctAnswer: 2,
      subject: 'Load Testing',
      topic: 'Web',
      difficulty: 'easy',
    },
    {
      text: 'LOADTEST: Which HTTP method retrieves data?',
      options: ['POST', 'GET', 'DELETE', 'PATCH'],
      correctAnswer: 1,
      subject: 'Load Testing',
      topic: 'Web',
      difficulty: 'easy',
    },
    {
      text: 'LOADTEST: What does SQL stand for?',
      options: [
        'Structured Query Language',
        'Simple Question Language',
        'System Query Logic',
        'Sequential Query Link',
      ],
      correctAnswer: 0,
      subject: 'Load Testing',
      topic: 'Databases',
      difficulty: 'easy',
    },
  ];

  const questions = await Question.insertMany(
    questionData.map((question) => ({
      ...question,
      owner: instructor._id,
      type: 'mcq',
      status: 'active',
    }))
  );

  // Create a published quiz.
  const quiz = await Quiz.create({
    instructor: instructor._id,
    title: QUIZ_TITLE,
    questions: questions.map((question) => question._id),
    timeLimitMinutes: 60,
    published: true,
    publishedAt: new Date(),
  });

  console.log('Created dedicated quiz:', quiz.title);

  // Create 500 unique student accounts.
  const rows = ['email,password'];

  for (let i = 1; i <= USER_COUNT; i += 1) {
    const email =
      `${EMAIL_PREFIX}${String(i).padStart(3, '0')}@csmqp.test`;

    await User.updateOne(
      { email },
      {
        $setOnInsert: {
          name: `Load Test Student ${i}`,
          email,
          passwordHash,
          role: 'student',
          status: 'active',
        },
      },
      { upsert: true }
    );

    rows.push(`${email},${PASSWORD}`);
  }

  // Save credentials locally.
  const csvPath = path.join(__dirname, 'users.csv');

  fs.writeFileSync(
    csvPath,
    `${rows.join('\n')}\n`,
    'utf8'
  );

  console.log(`Created/verified ${USER_COUNT} student accounts.`);
  console.log(`Credentials saved to ${csvPath}`);
  console.log('Quiz ID:', String(quiz._id));
  console.log('Load-test setup completed successfully.');
}

setup()
  .catch((error) => {
    console.error('Load-test setup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
