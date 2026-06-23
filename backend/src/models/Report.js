const mongoose = require('mongoose');

// UGC moderation report (Google Play "User Generated Content" policy).
// A player can report another player / a match's chat or call.
const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },
  reason: { type: String, enum: ['harassment', 'hate', 'spam', 'inappropriate', 'cheating', 'other'], default: 'other' },
  detail: { type: String, maxlength: 1000 },
  context: { type: String }, // 'chat' | 'call' | 'profile'
  status: { type: String, enum: ['open', 'reviewed', 'actioned', 'dismissed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
});
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
