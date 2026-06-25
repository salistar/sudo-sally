// Single source of truth for the JWT signing secret. index.js fails fast in
// production when JWT_SECRET is unset, so the 'secret' fallback below only ever
// applies in dev/test. Centralizing it removes the `process.env.JWT_SECRET ||
// 'secret'` literal that was copy-pasted across auth/middleware/services.
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

module.exports = { JWT_SECRET };
