const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  console.log("Method:", req.method, "Path:", req.path);
  console.log("Headers:", req.headers);

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Không có token, quyền truy cập bị từ chối!" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);

    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(401).json({ message: "ID người dùng không hợp lệ!" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User không tồn tại!" });
    }

    req.user = user;
    console.log("Authenticated user:", user.email);
    next();
  } catch (error) {
    console.error("Token error:", error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(403).json({ message: "Token đã hết hạn!" });
    }
    return res.status(403).json({ message: "Token không hợp lệ!" });
  }
};

module.exports = authMiddleware;