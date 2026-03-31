const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Account = require('../models/Account');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

// Middleware xác thực Token (Để biết ai đang đẩy dữ liệu lên)
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Từ chối truy cập' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Chứa userId
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

// API ĐẨY DỮ LIỆU TỪ MÁY LÊN CLOUD (PUSH)
router.post('/push', authMiddleware, async (req, res) => {
  try {
    const { accounts, categories, transactions } = req.body;
    const userId = req.user.userId;

    // Để tránh trùng lặp, chiến lược đơn giản nhất lúc này là: 
    // Xóa sạch dữ liệu cũ của user này trên Cloud, rồi nhét toàn bộ dữ liệu mới từ máy lên.
    // (Ở các app lớn sẽ dùng thuật toán Upsert so sánh timestamp, nhưng cách này an toàn và nhanh nhất cho đồ án)

    await Account.deleteMany({ userId });
    await Category.deleteMany({ userId });
    await Transaction.deleteMany({ userId });

    // Cấy thêm userId vào từng record trước khi lưu
    const mappedAccounts = accounts.map(a => ({ ...a, userId }));
    const mappedCategories = categories.map(c => ({ ...c, userId }));
    const mappedTransactions = transactions.map(t => ({ ...t, userId }));

    if (mappedAccounts.length > 0) await Account.insertMany(mappedAccounts);
    if (mappedCategories.length > 0) await Category.insertMany(mappedCategories);
    if (mappedTransactions.length > 0) await Transaction.insertMany(mappedTransactions);

    res.json({ message: 'Đồng bộ lên mây thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đồng bộ', error: error.message });
  }
});
// API KÉO DỮ LIỆU TỪ MÂY VỀ MÁY (PULL)
router.get('/pull', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; // Lấy ID của user đang đăng nhập từ Token

    // Tìm toàn bộ dữ liệu thuộc về user này
    const accounts = await Account.find({ userId });
    const categories = await Category.find({ userId });
    const transactions = await Transaction.find({ userId });

    // Trả về một cục JSON chứa cả 3 mảng
    res.json({
      accounts,
      categories,
      transactions
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi kéo dữ liệu', error: error.message });
  }
});

module.exports = router;