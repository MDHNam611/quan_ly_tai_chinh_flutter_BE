const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🟢 Đã kết nối thành công tới MongoDB'))
  .catch((err) => console.log('🔴 Lỗi kết nối MongoDB:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sync', require('./routes/sync'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});