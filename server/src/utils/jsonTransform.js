/** Shared toJSON options: expose `id`, hide `_id`, `__v` and password hashes. */
module.exports = {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
};
