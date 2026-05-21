const mongoose = require('mongoose');

const voiceTimeSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  userId:       { type: String, required: true },
  totalSeconds: { type: Number, default: 0 },
  weekSeconds:  { type: Number, default: 0 },
  monthSeconds: { type: Number, default: 0 },
  streakDays:   { type: Number, default: 0 },
  bestStreak:   { type: Number, default: 0 },
  lastActiveDay:{ type: String, default: null },
  weekReset:    { type: String, default: null },
  monthReset:   { type: String, default: null },
});

voiceTimeSchema.index({ guildId: 1, userId: 1 }, { unique: true });
voiceTimeSchema.index({ guildId: 1, totalSeconds: -1 });

module.exports = mongoose.model('VoiceTime', voiceTimeSchema);