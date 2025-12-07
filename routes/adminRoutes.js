// routes/adminRoutes.js - Optimized version
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
 *     summary: Lấy thống kê tổng quan hệ thống
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: number
 *                 activeUsers:
 *                   type: number
 *                 totalWorkspaces:
 *                   type: number
 *                 totalBoards:
 *                   type: number
 *                 inactiveUsers:
 *                   type: number
 *       403:
 *         description: Không có quyền admin
 */
router.get("/dashboard/stats", adminController.getDashboardStats);

// ============= USER MANAGEMENT =============

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lấy danh sách tất cả users với filter và search
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
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
 *           enum: [all, online, inactive]
 *         description: Lọc theo trạng thái
 *     responses:
 *       200:
 *         description: Danh sách users với pagination
 *       403:
 *         description: Không có quyền admin
 */
router.get("/users", adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Lấy chi tiết user kèm thống kê
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
 *         description: Chi tiết user và stats (workspaces, boards, activities)
 *       400:
 *         description: User ID không hợp lệ
 *       404:
 *         description: User không tồn tại
 */
router.get("/users/:userId", adminController.getUserDetails);

/**
 * @swagger
 * /api/admin/users/{userId}/admin:
 *   put:
 *     summary: Cấp hoặc thu hồi quyền admin
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
 *     responses:
 *       200:
 *         description: Cập nhật quyền admin thành công
 *       400:
 *         description: Không thể thay đổi quyền của chính mình
 */
router.put("/users/:userId/admin", adminController.updateAdminStatus);

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   post:
 *     summary: Ban user
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
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do ban
 *               duration:
 *                 type: number
 *                 description: Thời hạn ban (ngày), null = vĩnh viễn
 *     responses:
 *       200:
 *         description: Ban user thành công
 *       400:
 *         description: Không thể ban chính mình
 *       403:
 *         description: Không thể ban admin khác
 */
router.post("/users/:userId/ban", adminController.banUser);

/**
 * @swagger
 * /api/admin/users/{userId}/unban:
 *   post:
 *     summary: Unban user
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
 *         description: Unban user thành công
 *       400:
 *         description: User chưa bị ban
 */
router.post("/users/:userId/unban", adminController.unbanUser);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Xóa user (soft hoặc permanent)
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
 *                 default: false
 *                 description: true = xóa vĩnh viễn, false = soft delete
 *     responses:
 *       200:
 *         description: Xóa user thành công
 *       400:
 *         description: Không thể xóa chính mình
 */
router.delete("/users/:userId", adminController.deleteUser);

/**
 * @swagger
 * /api/admin/users/{userId}/restore:
 *   post:
 *     summary: Khôi phục user đã bị xóa (soft delete)
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
 */
router.post("/users/:userId/restore", adminController.restoreUser);

// ============= WORKSPACE MANAGEMENT =============

/**
 * @swagger
 * /api/admin/workspaces:
 *   get:
 *     summary: Lấy danh sách tất cả workspaces (admin thấy hết)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên workspace
 *     responses:
 *       200:
 *         description: Danh sách workspaces với pagination
 */
router.get("/workspaces", adminController.getAllWorkspaces);

/**
 * @swagger
 * /api/admin/workspaces/{workspaceId}:
 *   get:
 *     summary: Lấy chi tiết workspace kèm thống kê
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết workspace và stats (boards, members, activities)
 *       400:
 *         description: Workspace ID không hợp lệ
 *       404:
 *         description: Workspace không tồn tại
 */
router.get("/workspaces/:workspaceId", adminController.getWorkspaceDetails);

/**
 * @swagger
 * /api/admin/workspaces/{workspaceId}:
 *   delete:
 *     summary: Xóa workspace (soft hoặc permanent)
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
 *                 default: false
 *     responses:
 *       200:
 *         description: Xóa workspace thành công
 */
router.delete("/workspaces/:workspaceId", adminController.deleteWorkspace);

/**
 * @swagger
 * /api/admin/workspaces/{workspaceId}/restore:
 *   post:
 *     summary: Khôi phục workspace đã bị xóa
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Khôi phục workspace thành công
 *       400:
 *         description: Workspace chưa bị xóa
 */
router.post("/workspaces/:workspaceId/restore", adminController.restoreWorkspace);

// ============= BOARD MANAGEMENT =============

/**
 * @swagger
 * /api/admin/boards:
 *   get:
 *     summary: Lấy danh sách tất cả boards (admin thấy hết)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tiêu đề board
 *     responses:
 *       200:
 *         description: Danh sách boards với pagination
 */
router.get("/boards", adminController.getAllBoards);

/**
 * @swagger
 * /api/admin/boards/{boardId}:
 *   get:
 *     summary: Lấy chi tiết board kèm thống kê
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: boardId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết board và stats (lists, members, activities)
 *       400:
 *         description: Board ID không hợp lệ
 *       404:
 *         description: Board không tồn tại
 */
router.get("/boards/:boardId", adminController.getBoardDetails);

/**
 * @swagger
 * /api/admin/boards/{boardId}:
 *   delete:
 *     summary: Xóa board (soft hoặc permanent)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: boardId
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
 *                 default: false
 *     responses:
 *       200:
 *         description: Xóa board thành công
 */
router.delete("/boards/:boardId", adminController.deleteBoard);

/**
 * @swagger
 * /api/admin/boards/{boardId}/restore:
 *   post:
 *     summary: Khôi phục board đã bị xóa
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: boardId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Khôi phục board thành công
 *       400:
 *         description: Board chưa bị xóa
 */
router.post("/boards/:boardId/restore", adminController.restoreBoard);

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
 *         description: Đã gửi thông báo thành công
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
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Lọc theo loại activity
 *     responses:
 *       200:
 *         description: Danh sách activity logs
 */
router.get("/logs", adminController.getAdminActivityLogs);

router.get('/bans/expiring', adminController.getExpiringBans);

module.exports = router;