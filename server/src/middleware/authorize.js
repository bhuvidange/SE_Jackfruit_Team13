const HttpError = require('../utils/httpError');

/** Role-based access control (CSMQP-F-003): usage `authorize('instructor', 'admin')` after `authenticate`. */
module.exports = function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, 'You do not have permission to perform this action');
    }
    next();
  };
};
