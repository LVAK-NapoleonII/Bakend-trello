// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// Tất cả routes đều cần auth và admin
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Quản lý admin (chỉ dành cho admin)
 */

// ============= DASHBOARD =============

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Lấy thống kê tổng quan
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê hệ thống
 *       403:
 *         description: Không có quyền admin
 */
router.get("/dashboard/stats", adminController.getDashboardStats);

// ============= USER MANAGEMENT =============

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lấy danh sách tất cả users
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số lượng users mỗi trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo email hoặc tên
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [online, inactive]
 *         description: Lọc theo trạng thái
 *     responses:
 *       200:
 *         description: Danh sách users
 *       403:
 *         description: Không có quyền admin
 */
router.get("/users", adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Lấy chi tiết user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Thông tin chi tiết user
 *       403:
 *         description: Không có quyền admin
 *       404:
 *         description: User không tồn tại
 */
router.get("/users/:userId", adminController.getUserDetails);

/**
 * @swagger
 * /api/admin/users/{userId}/admin:
 *   put:
 *     summary: Cập nhật quyền admin cho user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isAdmin
 *             properties:
 *               isAdmin:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Cập nhật quyền admin thành công
 *       400:
 *         description: Không thể thay đổi quyền của chính mình
 *       403:
 *         description: Không có quyền admin
 */
router.put("/users/:userId/admin", adminController.updateAdminStatus);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Xóa user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permanent:
 *                 type: boolean
 *                 example: false
 *                 description: true = xóa vĩnh viễn, false = soft delete
 *     responses:
 *       200:
 *         description: Xóa user thành công
 *       400:
 *         description: Không thể xóa chính mình
 *       403:
 *         description: Không có quyền admin
 */
router.delete("/users/:userId", adminController.deleteUser);

/**
 * @swagger
 * /api/admin/users/{userId}/restore:
 *   post:
 *     summary: Khôi phục user đã bị xóa
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Khôi phục user thành công
 *       400:
 *         description: User chưa bị xóa
 *       403:
 *         description: Không có quyền admin
 */
router.post("/users/:userId/restore", adminController.restoreUser);

// ============= WORKSPACE MANAGEMENT =============

/**
 * @swagger
 * /api/admin/workspaces:
 *   get:
 *     summary: Lấy danh sách tất cả workspaces
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách workspaces
 *       403:
 *         description: Không có quyền admin
 */
router.get("/workspaces", adminController.getAllWorkspaces);

/**
 * @swagger
 * /api/admin/workspaces/{workspaceId}:
 *   delete:
 *     summary: Xóa workspace
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permanent:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Xóa workspace thành công
 *       403:
 *         description: Không có quyền admin
 */
router.delete("/workspaces/:workspaceId", adminController.deleteWorkspace);

// ============= BOARD MANAGEMENT =============

/**
 * @swagger
 * /api/admin/boards:
 *   get:
 *     summary: Lấy danh sách tất cả boards
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách boards
 *       403:
 *         description: Không có quyền admin
 */
router.get("/boards", adminController.getAllBoards);

// ============= INACTIVE USER CLEANUP =============

/**
 * @swagger
 * /api/admin/users/inactive/list:
 *   get:
 *     summary: Lấy danh sách users không hoạt động
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 90
 *         description: Số ngày không hoạt động
 *     responses:
 *       200:
 *         description: Danh sách users không hoạt động
 *       403:
 *         description: Không có quyền admin
 */
router.get("/users/inactive/list", adminController.getInactiveUsers);

/**
 * @swagger
 * /api/admin/users/inactive/notify:
 *   post:
 *     summary: Gửi thông báo cho users không hoạt động
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đã gửi thông báo
 *       403:
 *         description: Không có quyền admin
 */
router.post("/users/inactive/notify", adminController.sendInactivityNotices);

/**
 * @swagger
 * /api/admin/users/inactive/delete:
 *   post:
 *     summary: Xóa users không hoạt động đã được thông báo
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đã xóa users không hoạt động
 *       403:
 *         description: Không có quyền admin
 */
router.post("/users/inactive/delete", adminController.deleteInactiveUsers);

// ============= ACTIVITY LOGS =============

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Lấy logs hoạt động của admin
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Lọc theo loại activity
 *     responses:
 *       200:
 *         description: Danh sách activity logs
 *       403:
 *         description: Không có quyền admin
 */
router.get("/logs", adminController.getAdminActivityLogs);

module.exports = router;