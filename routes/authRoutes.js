const express = require("express");
const { register,forgotPassword, resetPassword, verifyOTP, login } = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware"); 
const router = express.Router();

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
 *         description: Email đã tồn tại
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
 *         description: OTP không hợp lệ
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
router.post("/login", login);

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
 *                     email:
 *                       type: string
 *       401:
 *         description: Không có token hoặc token không hợp lệ
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
 *       400:
 *         description: Email không tồn tại
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
 */
router.post("/reset-password", resetPassword);

module.exports = router;
