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
} = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Đảm bảo thư mục uploads tồn tại
const uploadDir = path.join(__dirname, "../uploads");
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận OTP."
   *       400:
   *         description: Email đã tồn tại hoặc thiếu thông tin
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Email đã tồn tại"
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Lỗi server"
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Xác thực OTP thành công! Bạn có thể đăng nhập ngay bây giờ."
   *       400:
   *         description: OTP không hợp lệ hoặc đã hết hạn
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "OTP không hợp lệ hoặc đã hết hạn"
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Lỗi server"
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       example: "123456789"
   *                     fullName:
   *                       type: string
   *                       example: "Nguyễn Văn A"
   *                     email:
   *                       type: string
   *                       example: "user@example.com"
   *                     avatar:
   *                       type: string
   *                       example: "https://api.dicebear.com/9.x/avataaars/svg?seed=user@example.com"
   *       400:
   *         description: Sai email hoặc mật khẩu
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Sai email hoặc mật khẩu"
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Lỗi server"
   */
  router.post("/login", (req, res) => login(req, res, io));

  /**
   * @swagger
   * /api/auth/refresh-token:
   *   post:
   *     summary: Làm mới access token bằng refresh token
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *     responses:
   *       200:
   *         description: Làm mới token thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *       401:
   *         description: Refresh token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Refresh token không hợp lệ"
   */
  router.post("/refresh-token", refreshToken);

  /**
   * @swagger
   * /api/auth/profile:
   *   get:
   *     summary: Lấy thông tin người dùng (yêu cầu Bearer Token)
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Trả về thông tin người dùng
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Chào mừng bạn!"
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       example: "123456789"
   *                     email:
   *                       type: string
   *                       example: "user@example.com"
   *                     fullName:
   *                       type: string
   *                       example: "Nguyễn Văn A"
   *                     avatar:
   *                       type: string
   *                       example: "https://api.dicebear.com/9.x/avataaars/svg?seed=user@example.com"
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Không có token hoặc token không hợp lệ"
   */
  router.get("/profile", authMiddleware, (req, res) => {
    res.json({ message: "Chào mừng bạn!", user: req.user });
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "OTP đã gửi qua email"
   *       400:
   *         description: Email không tồn tại
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Email không tồn tại"
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Lỗi server"
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Mật khẩu đã được cập nhật thành công"
   *       400:
   *         description: OTP không hợp lệ hoặc hết hạn
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "OTP không hợp lệ hoặc đã hết hạn"
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Lỗi server"
   */
  router.post("/reset-password", resetPassword);

  /**
   * @swagger
   * /api/auth/update-avatar:
   *   post:
   *     summary: Cập nhật avatar của người dùng (yêu cầu Bearer Token)
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
   *                 description: File ảnh avatar (jpg, png, v.v.)
   *     responses:
   *       200:
   *         description: Cập nhật avatar thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Cập nhật avatar thành công"
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       example: "123456789"
   *                     fullName:
   *                       type: string
   *                       example: "Nguyễn Văn A"
   *                     email:
   *                       type: string
   *                       example: "user@example.com"
   *                     avatar:
   *                       type: string
   *                       example: "/uploads/123456789-image.jpg"
   *       400:
   *         description: Thiếu file avatar
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Vui lòng upload file avatar"
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Không có token hoặc token không hợp lệ"
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Lỗi server"
   */
  router.post("/update-avatar", authMiddleware, upload.single("avatar"), updateAvatar);

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Đăng xuất và xóa refresh token
   *     tags: [Auth]
   *     responses:
   *       200:
   *         description: Đăng xuất thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đăng xuất thành công"
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Lỗi server"
   */
  router.post("/logout", (req, res) => logout(req, res, io));

  return router;
};