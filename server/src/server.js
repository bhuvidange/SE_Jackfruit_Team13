const app = require('./app');
const config = require('./config');
const connectDb = require('./db');

connectDb()
  .then(() => {
    app.listen(config.port, () => console.log(`CSMQP API listening on port ${config.port}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
