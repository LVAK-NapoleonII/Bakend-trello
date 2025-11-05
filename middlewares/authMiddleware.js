// middlewares/authMiddleware.js - Updated with ban check
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Không có token, quyền truy cập bị từ chối!" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(401).json({ message: "ID người dùng không hợp lệ!" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User không tồn tại!" });
    }

    // Check if user is banned
    await user.checkBanExpiry(); // Auto-unban if expired
    
    if (user.isBanned) {
      const message = user.banExpiresAt 
        ? `Tài khoản của bạn đã bị khóa đến ${user.banExpiresAt.toLocaleDateString('vi-VN')}. Lý do: ${user.banReason}`
        : `Tài khoản của bạn đã bị khóa vĩnh viễn. Lý do: ${user.banReason}`;
      
      return res.status(403).json({ 
        message,
        isBanned: true,
        banReason: user.banReason,
        bannedAt: user.bannedAt,
        banExpiresAt: user.banExpiresAt
      });
    }

    // Check if user is hidden (deleted)
    if (user.isHidden) {
      return res.status(403).json({ message: "Tài khoản đã bị xóa!" });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(403).json({ message: "Token đã hết hạn!" });
    }
    return res.status(403).json({ message: "Token không hợp lệ!" });
  }
};

module.exports = authMiddleware;