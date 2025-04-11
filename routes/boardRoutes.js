const express = require("express");
const {
  createBoard,
  getUserBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
} = require("../controllers/boardController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Boards
 *   description: Quản lý bảng làm việc
 */

/**
 * @swagger
 * /api/boards:
 *   post:
 *     summary: Tạo bảng mới
 *     tags: [Boards]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - workspace
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               background:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [public, private]
 *               workspace:
 *                 type: string
 *                 description: ID của workspace (phải là ObjectId hợp lệ)
 *                 example: "507f1f77bcf86cd799439011"
 *     responses:
 *       201:
 *         description: Tạo bảng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.post("/", authMiddleware, createBoard);

/**
 * @swagger
 * /api/boards:
 *   get:
 *     summary: Lấy danh sách bảng của người dùng hiện tại
 *     tags: [Boards]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách bảng
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.get("/", authMiddleware, getUserBoards);

/**
 * @swagger
 * /api/boards/{id}:
 *   get:
 *     summary: Lấy chi tiết một bảng
 *     tags: [Boards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID của bảng
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin chi tiết bảng (kèm workspace)
 *       404:
 *         description: Không tìm thấy bảng
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.get("/:id", authMiddleware, getBoardById);

/**
 * @swagger
 * /api/boards/{id}:
 *   put:
 *     summary: Cập nhật bảng
 *     tags: [Boards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bảng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               background:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [public, private]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền cập nhật bảng
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.put("/:id", authMiddleware, updateBoard);

/**
 * @swagger
 * /api/boards/{id}:
 *   delete:
 *     summary: Xóa bảng
 *     tags: [Boards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID bảng cần xóa
 *     responses:
 *       200:
 *         description: Xoá bảng thành công
 *       403:
 *         description: Không có quyền xóa bảng
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.delete("/:id", authMiddleware, deleteBoard);

module.exports = router;