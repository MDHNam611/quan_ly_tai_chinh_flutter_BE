const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // 👉 ĐÃ THÊM: Thư viện gửi mail
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

// =========================================================
// CẤU HÌNH GỬI MAIL & RATE LIMIT
// =========================================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Lấy từ file .env
    pass: process.env.EMAIL_PASS  // Lấy từ file .env
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: { message: 'Bạn đã thử quá nhiều lần, vui lòng quay lại sau 15 phút.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Giới hạn siêu nghiêm ngặt cho API Reset Password (Chống Brute-force OTP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, // Chỉ cho phép nhập mã OTP tối đa 5 lần mỗi 15 phút
  message: { message: 'Bạn đã nhập sai OTP quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
});

// =========================================================
// API 1: ĐĂNG KÝ
// =========================================================
router.post('/register', authLimiter, async (req, res) => {
  try {
    let { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Vui lòng cung cấp đủ thông tin' });

    password = password.trim();

    if (password.length < 8) return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự' });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ message: 'Phải chứa ít nhất 1 chữ cái viết hoa (A-Z)' });
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return res.status(400).json({ message: 'Phải chứa ít nhất 1 ký tự đặc biệt' });

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'Email đã được sử dụng' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'Đăng ký thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// =========================================================
// API 2: ĐĂNG NHẬP
// =========================================================
router.post('/login', authLimiter, async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Vui lòng cung cấp đủ thông tin' });

    password = password.trim();

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email không tồn tại' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Sai mật khẩu' });

    const token = jwt.sign({ userId: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: 'Đăng nhập thành công', token, name: user.name });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// =========================================================
// API 3: QUÊN MẬT KHẨU (GỬI OTP VỀ EMAIL)
// =========================================================
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Vui lòng nhập email' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });

    // 1. Tạo mã OTP 6 số ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Hash mã OTP
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // 3. Lưu OTP và TTL (5 phút)
    user.resetOtp = hashedOtp;
    user.resetOtpExpire = Date.now() + 5 * 60 * 1000; // 5 phút
    user.otpAttempts = 0; // Reset số lần nhập sai
    user.lockUntil = null;
    await user.save();

    // 4. Mẫu Email HTML thiết kế mới, chuẩn App Tài Chính
    const mailOptions = {
      from: `"Quản Lý Tài Chính" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔒 Mã OTP Khôi Phục Mật Khẩu',
      html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 40px 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          
          <div style="background-color: #3F51B5; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">💳 QUẢN LÝ TÀI CHÍNH</h1>
          </div>
          
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Xin chào <strong>${user.name}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #555;">Hệ thống vừa nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn. Dưới đây là mã xác thực OTP. Mã này sẽ tự động hết hạn sau <strong>5 phút</strong>.</p>
            
            <div style="margin: 35px 0; text-align: center;">
              <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3F51B5; background-color: #e8eaf6; padding: 15px 30px; border-radius: 8px; border: 1px dashed #c5cae9;">
                ${otp}
              </span>
            </div>
            
            <p style="font-size: 14px; color: #d32f2f; background-color: #ffebee; padding: 15px; border-radius: 6px; text-align: center; margin-bottom: 0; border-left: 4px solid #d32f2f;">
              <strong>⚠️ Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai. Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này.
            </p>
          </div>
          
          <div style="background-color: #f9fafa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="font-size: 12px; color: #888; margin: 0;">Hệ thống Quản Lý Tài Chính Cá Nhân</p>
            <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">Phát triển bởi Mai Đức Hoàng Nam &copy; 2026</p>
          </div>
          
        </div>
      </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn' });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi gửi mail. Vui lòng kiểm tra lại cấu hình.', error: error.message });
  }
});

// =========================================================
// API 4: XÁC THỰC OTP & ĐỔI MẬT KHẨU MỚI
// =========================================================
router.post('/reset-password', otpLimiter, async (req, res) => {
  try {
    let { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Vui lòng cung cấp đủ thông tin' });

    newPassword = newPassword.trim();
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({ message: 'Mật khẩu mới không đạt chuẩn bảo mật' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetOtp || !user.resetOtpExpire) {
      return res.status(400).json({ message: 'Yêu cầu không hợp lệ hoặc OTP chưa được tạo' });
    }

    // Kiểm tra tài khoản có đang bị khóa do nhập sai nhiều lần không
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ message: 'Tài khoản đang bị khóa tạm thời. Thử lại sau ít phút.' });
    }

    // Kiểm tra OTP hết hạn
    if (Date.now() > user.resetOtpExpire) {
      user.resetOtp = undefined;
      user.resetOtpExpire = undefined;
      await user.save();
      return res.status(400).json({ message: 'Mã OTP đã hết hạn, vui lòng gửi lại yêu cầu' });
    }

    // So sánh OTP
    const isMatch = await bcrypt.compare(otp, user.resetOtp);
    if (!isMatch) {
      user.otpAttempts += 1;
      if (user.otpAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // Khóa 15 phút nếu sai 5 lần
        await user.save();
        return res.status(403).json({ message: 'Bạn đã nhập sai 5 lần. Tính năng bị khóa 15 phút.' });
      }
      await user.save();
      return res.status(400).json({ message: `Mã OTP không chính xác. Bạn còn ${5 - user.otpAttempts} lần thử.` });
    }

    // Đổi mật khẩu thành công
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Dọn rác
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;
    user.otpAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.status(200).json({ message: 'Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// =========================================================
// API 5: ĐĂNG NHẬP BẰNG GOOGLE (Giữ nguyên)
// =========================================================
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const randomPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, salt);
      user = new User({ name: name, email: email, password: randomPassword });
      await user.save();
    }

    const token = jwt.sign({ userId: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: 'Đăng nhập Google thành công', token, name: user.name });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi đăng nhập Google', error: error.message });
  }
});

module.exports = router;