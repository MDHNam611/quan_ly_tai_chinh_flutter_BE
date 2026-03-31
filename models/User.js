const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // 👉 ĐÃ THÊM: Các trường phục vụ Quên mật khẩu
  resetOtp: { type: String, default: null },
  resetOtpExpire: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 }, // Đếm số lần nhập sai OTP
  lockUntil: { type: Date, default: null }   // Khóa chức năng đổi pass nếu spam
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);