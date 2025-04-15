const express = require("express");
const {
  createWorkspace,
  getWorkspaces, 
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
} = require("../controllers/workspaceController");

const authMiddleware = require("../middlewares/authMiddleware");
const workspaceMiddleware = require("../middlewares/workspaceMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Workspaces
 *   description: Quản lý không gian làm việc (workspace)
 */

/**
 * @swagger
 * /api/workspaces:
 *   post:
 *     summary: Tạo một workspace mới
 *     tags: [Workspaces]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Frontend Team"
 *     responses:
 *       201:
 *         description: Workspace đã được tạo
 *       400:
 *         description: Lỗi dữ liệu
 */
router.post("/", authMiddleware, createWorkspace);

/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     summary: Lấy danh sách các workspace của người dùng
 *     tags: [Workspaces]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách workspaces
 */
router.get("/", authMiddleware, getWorkspaces); // Sửa tên hàm gọi ở đây

/**
 * @swagger
 * /api/workspaces/{id}:
 *   get:
 *     summary: Lấy chi tiết một workspace
 *     tags: [Workspaces]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của workspace
 *     responses:
 *       200:
 *         description: Thông tin workspace
 *       403:
 *         description: Không có quyền truy cập
 */
router.get("/:id", authMiddleware, workspaceMiddleware, getWorkspaceById);

/**
 * @swagger
 * /api/workspaces/{id}:
 *   put:
 *     summary: Cập nhật workspace
 *     tags: [Workspaces]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của workspace
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Backend Team"
 *               description:
 *                 type: string
 *                 example: "Nhóm phụ trách backend hệ thống Trello clone"
 *               background:
 *                 type: string
 *                 example: "#ffffff" 
 *               isPublic:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Đã cập nhật workspace
 *       403:
 *         description: Không có quyền
 *       500:
 *         description: Lỗi server
 */
router.put("/:id", authMiddleware, workspaceMiddleware, updateWorkspace);

/**
 * @swagger
 * /api/workspaces/{id}:
 *   delete:
 *     summary: Xóa workspace
 *     tags: [Workspaces]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã xóa workspace
 */
router.delete("/:id", authMiddleware, workspaceMiddleware, deleteWorkspace);

module.exports = router;
