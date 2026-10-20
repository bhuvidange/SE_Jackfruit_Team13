class HttpError extends Error {
  /** @param {number} status @param {string} message @param {object} [extra] merged into the JSON body */
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

module.exports = HttpError;
