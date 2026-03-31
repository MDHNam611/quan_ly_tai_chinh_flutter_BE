const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  offlineId: { type: String, required: true }, // ID offline để tránh trùng lặp
  accountId: { type: String, required: true },
  toAccountId: { type: String }, // Dành cho chuyển khoản
  category: { type: String, required: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  amount: { type: Number, required: true },
  note: { type: String },
  date: { type: String, required: true }
});

module.exports = mongoose.model('Transaction', TransactionSchema);