// Escape a user-supplied string so it is treated as a LITERAL inside a RegExp
// (e.g. an anchored case-insensitive username/search lookup). Without this a
// crafted query could inject regex metacharacters (ReDoS / unexpected matches).
module.exports = function escapeRegex(s) {
  return String(s == null ? '' : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
