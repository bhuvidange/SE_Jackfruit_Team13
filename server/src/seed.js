// Demo data: 1 admin, 2 instructors, 3 students, sample questions, a study material and one published quiz.
// Usage: npm run seed   (WARNING: clears the users, questions, materials, quizzes and attempts collections)
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const connectDb = require('./db');
const User = require('./models/User');

// Models from later pieces of the sprint are optional so the seed runs at every stage.
function optionalModel(file) {
  try {
    return require(file);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes(file)) return null;
    throw err;
  }
}
const Question = optionalModel('./models/Question');
const Material = optionalModel('./models/Material');
const Quiz = optionalModel('./models/Quiz');
const QuizAttempt = optionalModel('./models/QuizAttempt');

const PASSWORD = 'Demo@1234';

const mcq = (text, options, correctAnswer, subject, topic, difficulty) => ({ type: 'mcq', text, options, correctAnswer, subject, topic, difficulty });
const tf = (text, correctAnswer, subject, topic, difficulty) => ({ type: 'tf', text, options: ['True', 'False'], correctAnswer, subject, topic, difficulty });

const QUESTIONS = [
  mcq('Which data structure uses FIFO ordering?', ['Stack', 'Queue', 'Tree', 'Graph'], 1, 'Data Structures', 'Queues', 'easy'),
  mcq('What is the time complexity of binary search?', ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 1, 'Algorithms', 'Searching', 'easy'),
  mcq('Which traversal visits the root first?', ['Inorder', 'Postorder', 'Preorder', 'Level order only'], 2, 'Data Structures', 'Trees', 'medium'),
  mcq('Which HTTP method is idempotent?', ['POST', 'PUT', 'PATCH', 'CONNECT'], 1, 'Web', 'HTTP', 'medium'),
  mcq('What does ACID stand for in databases?', ['Atomicity, Consistency, Isolation, Durability', 'Access, Control, Integrity, Data', 'Atomicity, Control, Isolation, Data', 'None of these'], 0, 'Databases', 'Transactions', 'medium'),
  mcq('Which layer of the OSI model handles routing?', ['Data link', 'Network', 'Transport', 'Session'], 1, 'Networks', 'OSI model', 'medium'),
  mcq('Worst-case complexity of quicksort?', ['O(n log n)', 'O(n)', 'O(n^2)', 'O(log n)'], 2, 'Algorithms', 'Sorting', 'hard'),
  tf('A stack follows Last-In-First-Out order.', 0, 'Data Structures', 'Stacks', 'easy'),
  tf('TCP is a connectionless protocol.', 1, 'Networks', 'Transport layer', 'easy'),
  tf('A primary key can contain NULL values.', 1, 'Databases', 'Keys', 'medium'),
];

// Smallest useful PDF so the demo download has real content.
const SAMPLE_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 56>>stream
BT /F1 18 Tf 20 70 Td (CSMQP sample study material) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF
`;

async function seed() {
  await connectDb();
  for (const model of [User, Question, Material, Quiz, QuizAttempt]) if (model) await model.deleteMany({});

  const passwordHash = await bcrypt.hash(PASSWORD, config.bcryptRounds);
  const mk = (name, email, role) => ({ name, email, role, passwordHash });
  const users = await User.insertMany([
    mk('Ada Admin', 'admin@csmqp.test', 'admin'),
    mk('Ira Instructor', 'ira@csmqp.test', 'instructor'),
    mk('Ivan Instructor', 'ivan@csmqp.test', 'instructor'),
    mk('Sam Student', 'sam@csmqp.test', 'student'),
    mk('Sara Student', 'sara@csmqp.test', 'student'),
    mk('Sid Student', 'sid@csmqp.test', 'student'),
  ]);
  const ira = users.find((u) => u.email === 'ira@csmqp.test');
  const ivan = users.find((u) => u.email === 'ivan@csmqp.test');

  let questions = [];
  if (Question) {
    questions = await Question.insertMany(QUESTIONS.map((q, i) => ({ ...q, owner: i < 7 ? ira._id : ivan._id })));
  }

  if (Material) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const storedName = `${crypto.randomUUID()}.pdf`;
    fs.writeFileSync(`${config.uploadDir}/${storedName}`, SAMPLE_PDF);
    await Material.create({
      owner: ira._id,
      title: 'Introduction to Data Structures',
      description: 'Sample handout used for demos',
      subject: 'Data Structures',
      topic: 'Overview',
      originalName: 'intro-data-structures.pdf',
      format: 'pdf',
      mimeType: 'application/pdf',
      size: Buffer.byteLength(SAMPLE_PDF),
      storedName,
    });
  }

  if (Quiz && questions.length) {
    await Quiz.create({
      instructor: ira._id,
      title: 'Data Structures & Algorithms - Quick Check',
      questions: questions.slice(0, 5).map((q) => q._id),
      timeLimitMinutes: 10,
      published: true,
      publishedAt: new Date(),
    });
  }

  console.log('Seed complete. All demo accounts use the password:', PASSWORD);
  console.log(users.map((u) => `  ${u.role.padEnd(10)} ${u.email}`).join('\n'));
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
