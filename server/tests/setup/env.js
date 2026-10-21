const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4';
process.env.SUBMIT_GRACE_SECONDS = '5';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `csmqp-uploads-${process.pid}-${Date.now()}`);
