const express = require("express");
const {
  register,
  forgotPassword,
  resetPassword,
  verifyOTP,
  login,
  updateAvatar,
  refreshToken,
  logout,
  searchUsers,
} = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const notificationMiddleware = require("../middlewares/notificationMiddleware");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const User = require("../models/User"); 
const Board = require("../models/Board");
const mongoose = require("mongoose");

// Đảm bảo thư mục uploads tồn tại
const uploadDir = path.join(__dirname, "../Uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Validation cho file upload
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ cho phép upload file ảnh (jpeg, png, gif)"), false);
  }
};

// Cấu hình multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Middleware xử lý lỗi upload
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: "Lỗi upload file: " + err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Hàm khởi tạo router với io làm tham số
module.exports = (io) => {
  const router = express.Router();

  /**
   * @swagger
   * components:
   *   securitySchemes:
   *     BearerAuth:
   *       type: http
   *       scheme: bearer
   *       bearerFormat: JWT
   */

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Đăng ký tài khoản và nhận OTP qua email
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               fullName:
   *                 type: string
   *                 example: "Nguyễn Văn A"
   *               email:
   *                 type: string
   *                 example: "user@example.com"
   *               password:
   *                 type: string
   *                 example: "password123"
   *     responses:
   *       201:
   *         description: Đăng ký thành công, yêu cầu xác thực OTP
   *       400:
   *         description: Email đã tồn tại hoặc thiếu thông tin
   *       500:
   *         description: Lỗi server
   */
  router.post("/register", register);

  /**
   * @swagger
   * /api/auth/verify-otp:
   *   post:
   *     summary: Xác thực tài khoản bằng OTP
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: "user@example.com"
   *               otp:
   *                 type: string
   *                 example: "123456"
   *     responses:
   *       200:
   *         description: Xác thực thành công
   *       400:
   *         description: OTP không hợp lệ hoặc đã hết hạn
   *       500:
   *         description: Lỗi server
   */
  router.post("/verify-otp", verifyOTP);

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Đăng nhập (chỉ dành cho tài khoản đã xác thực)
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: "user@example.com"
   *               password:
   *                 type: string
   *                 example: "password123"
   *     responses:
   *       200:
   *         description: Đăng nhập thành công, trả về token
   *       400:
   *         description: Sai email hoặc mật khẩu
   *       500:
   *         description: Lỗi server
   */
  router.post("/login", (req, res) => login(req, res, io));

  /**
   * @swagger
   * /api/auth/refresh-token:
   *   post:
   *     summary: Làm mới access token bằng refresh token
   *     tags: [Auth]
   *     responses:
   *       200:
   *         description: Làm mới token thành công
   *       401:
   *         description: Refresh token không hợp lệ
   */
  router.post("/refresh-token", refreshToken);

  /**
 * @swagger
 * /api/auth/update-profile:
 *   put:
 *     summary: Cập nhật hồ sơ người dùng
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật hồ sơ thành công
 *       400:
 *         description: Thiếu thông tin
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 *       500:
 *         description: Lỗi server
 */
  router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("_id fullName email avatar");
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }
    res.json({
      message: "Chào mừng bạn!",
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Profile: Error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

  /**
   * @swagger
   * /api/auth/forgot-password:
   *   post:
   *     summary: Gửi OTP đến email để đặt lại mật khẩu
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: "test@example.com"
   *     responses:
   *       200:
   *         description: OTP đã được gửi
   *       400:
   *         description: Email không tồn tại
   *       500:
   *         description: Lỗi server
   */
  router.post("/forgot-password", forgotPassword);

  /**
   * @swagger
   * /api/auth/reset-password:
   *   post:
   *     summary: Đặt lại mật khẩu bằng OTP
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 example: "test@example.com"
   *               otp:
   *                 type: string
   *                 example: "123456"
   *               newPassword:
   *                 type: string
   *                 example: "newpassword123"
   *     responses:
   *       200:
   *         description: Mật khẩu đã cập nhật thành công
   *       400:
   *         description: OTP không hợp lệ hoặc hết hạn
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/reset-password",
    notificationMiddleware(
      (req) => `Mật khẩu của bạn đã được đặt lại thành công`,
      "general",
      "User"
    ),
    resetPassword
  );

  /**
   * @swagger
   * /api/auth/update-avatar:
   *   post:
   *     summary: Cập nhật avatar của người dùng
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               avatar:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: Cập nhật avatar thành công
   *       400:
   *         description: Thiếu file avatar
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/update-avatar",
    authMiddleware,
    upload.single("avatar"),
    handleUploadError,
    notificationMiddleware(
      (req) => `Avatar của bạn đã được cập nhật thành công`,
      "general",
      "User"
    ),
    updateAvatar
  );

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Đăng xuất và xóa refresh token
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Đăng xuất thành công
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.post("/logout", authMiddleware, (req, res) => logout(req, res, io));

/**
   * @swagger
   * /api/auth/search:
   *   get:
   *     summary: Tìm kiếm người dùng theo email hoặc tên
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Từ khóa tìm kiếm (email hoặc tên)
   *         example: "user@example.com"
   *       - in: query
   *         name: boardId
   *         schema:
   *           type: string
   *         description: ID của bảng để kiểm tra trạng thái thành viên
   *         example: "67123456abcdef1234567890"
   *     responses:
   *       200:
   *         description: Danh sách người dùng phù hợp
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 users:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *                       isPastMember:
   *                         type: boolean
   *       400:
   *         description: Query không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.get("/search", authMiddleware, async (req, res) => {
    try {
      const { query, boardId } = req.query;
      if (!query || query.trim().length < 1) {
        return res.status(400).json({ message: "Query là bắt buộc!" });
      }

      const users = await User.find({
        $or: [
          { email: { $regex: query.trim(), $options: "i" } },
          { fullName: { $regex: query.trim(), $options: "i" } },
        ],
      }).select("_id email fullName avatar");

      let pastMembers = [];
      let invitedUsers = [];
      if (boardId && mongoose.Types.ObjectId.isValid(boardId)) {
        const board = await Board.findById(boardId).select("members invitedUsers");
        if (board) {
          pastMembers = board.members
            .filter((m) => m.user && !m.isActive)
            .map((m) => m.user.toString());
          invitedUsers = board.invitedUsers
            .filter((i) => i.user && i.isActive)
            .map((i) => i.user.toString());
        }
      }

      const enrichedUsers = users.map((user) => ({
        ...user.toObject(),
        isPastMember: pastMembers.includes(user._id.toString()),
        isInvited: invitedUsers.includes(user._id.toString()),
      }));

      res.status(200).json({ users: enrichedUsers });
    } catch (err) {
      console.error("Error in searchUsers:", err.message, err.stack);
      res.status(500).json({
        message: "Lỗi server khi tìm kiếm người dùng!",
        error: err.message,
      });
    }
  });

  return router;
};