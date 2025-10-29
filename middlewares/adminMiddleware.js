// middlewares/adminMiddleware.js
const User = require("../models/User");

const adminMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại!" });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: "Bạn không có quyền admin!" });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error.message);
    return res.status(500).json({ message: "Lỗi xác thực admin" });
  }
};

module.exports = adminMiddleware;