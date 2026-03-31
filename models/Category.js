const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  icon: { type: String, required: true },
  color: { type: String, required: true }
});

module.exports = mongoose.model('Category', CategorySchema);