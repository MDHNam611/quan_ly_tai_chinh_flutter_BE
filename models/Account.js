const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Liên kết với User
  id: { type: String, required: true }, // ID offline từ Flutter
  name: { type: String, required: true },
  balance: { type: Number, default: 0 },
  icon: { type: String },
  description: { type: String }
});

module.exports = mongoose.model('Account', AccountSchema);