const mongoose = require('mongoose');
const config = require('./config');

module.exports = function connectDb() {
  return mongoose.connect(config.mongoUri);
};
