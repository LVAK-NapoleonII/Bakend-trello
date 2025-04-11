const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  console.log("Method:", req.method, "Path:", req.path);
  console.log("Headers:", req.headers);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Không có token, quyền truy cập bị từ chối!" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("Token error:", error.message);
    return res.status(403).json({ message: "Token không hợp lệ!" });
  }
};
module.exports = authMiddleware;
