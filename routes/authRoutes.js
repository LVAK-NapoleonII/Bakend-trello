const express = require("express");
const {
  register,
  forgotPassword,
  resetPassword,
  verifyOTP,
  login,
  getProfile, 
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Middleware xử lý lỗi upload
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: "File quá lớn. Giới hạn 5MB" });
    }
    return res.status(400).json({ message: "Lỗi upload file: " + err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Hàm khởi tạo router
module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * components:
   *   securitySchemes:
   *     BearerAuth:
   *       type: http
   *       scheme: bearer
   *       bearerFormat: JWT
   *   schemas:
   *     User:
   *       type: object
   *       properties:
   *         _id:
   *           type: string
   *         fullName:
   *           type: string
   *         email:
   *           type: string
   *         avatar:
   *           type: string
   *         isOnline:
   *           type: boolean
   *     ApiResponse:
   *       type: object
   *       properties:
   *         message:
   *           type: string
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
   *             required:
   *               - fullName
   *               - email
   *               - password
   *             properties:
   *               fullName:
   *                 type: string
   *                 example: "Nguyễn Văn A"
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "user@example.com"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 example: "password123"
   *     responses:
   *       201:
   *         description: Đăng ký thành công, yêu cầu xác thực OTP
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       400:
   *         description: Email đã tồn tại hoặc thiếu thông tin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
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
   *             required:
   *               - email
   *               - otp
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "user@example.com"
   *               otp:
   *                 type: string
   *                 pattern: '^[0-9]{6}$'
   *                 example: "123456"
   *     responses:
   *       200:
   *         description: Xác thực thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       400:
   *         description: OTP không hợp lệ hoặc đã hết hạn
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
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
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
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
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Email chưa được xác thực, không tồn tại hoặc sai mật khẩu
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   */
  router.post("/login", login);

  /**
   * @swagger
   * /api/auth/refresh-token:
   *   post:
   *     summary: Làm mới access token bằng refresh token
   *     tags: [Auth]
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
   *       401:
   *         description: Không có refresh token hoặc refresh token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   */
  router.post("/refresh-token", refreshToken);

  /**
   * @swagger
   * /api/auth/profile:
   *   get:
   *     summary: Lấy thông tin hồ sơ người dùng hiện tại
   *     tags: [Auth]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Thông tin hồ sơ người dùng
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       404:
   *         description: Người dùng không tồn tại
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   */
  router.get("/profile", authMiddleware, getProfile);

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
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "user@example.com"
   *     responses:
   *       200:
   *         description: OTP đã được gửi thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       400:
   *         description: Email không tồn tại hoặc thiếu thông tin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
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
   *             required:
   *               - email
   *               - otp
   *               - newPassword
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "user@example.com"
   *               otp:
   *                 type: string
   *                 pattern: '^[0-9]{6}$'
   *                 example: "123456"
   *               newPassword:
   *                 type: string
   *                 minLength: 6
   *                 example: "newpassword123"
   *     responses:
   *       200:
   *         description: Mật khẩu đã được cập nhật thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       400:
   *         description: Thiếu thông tin bắt buộc hoặc email không tồn tại
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       401:
   *         description: OTP không hợp lệ hoặc đã hết hạn
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   */
  router.post("/reset-password", resetPassword);

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
   *             required:
   *               - avatar
   *             properties:
   *               avatar:
   *                 type: string
   *                 format: binary
   *                 description: File ảnh (jpeg, png, gif) với kích thước tối đa 5MB
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
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Thiếu file avatar hoặc file không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       404:
   *         description: Người dùng không tồn tại
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
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
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   */
  router.post("/logout", authMiddleware, logout);

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
   *           minLength: 1
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
   *                     allOf:
   *                       - $ref: '#/components/schemas/User'
   *                       - type: object
   *                         properties:
   *                           isPastMember:
   *                             type: boolean
   *                             description: Có phải là thành viên cũ của bảng không
   *       400:
   *         description: Query là bắt buộc hoặc boardId không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       403:
   *         description: Bạn không có quyền truy cập bảng này
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       404:
   *         description: Bảng không tồn tại
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       500:
   *         description: Lỗi server
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   */
  router.get("/search", authMiddleware, searchUsers);

  return router;
};