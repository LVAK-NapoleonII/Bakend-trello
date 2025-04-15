const express = require("express");
const {
  createList,
  getListsByBoard,
  updateList,
  deleteList,
  updateCardOrder
} = require("../controllers/listController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Lists
 *   description: Quản lý cột trong bảng
 */

/**
 * @swagger
 * /api/lists:
 *   post:
 *     summary: Tạo cột mới trong bảng
 *     tags: [Lists]
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
 *               - board
 *             properties:
 *               title:
 *                 type: string
 *               board:
 *                 type: string
 *                 description: ID của board (phải là ObjectId hợp lệ) 
 *                 example: "507f1f77bcf86cd799439011"
 *               position:
 *                 type: number
 *     responses:
 *       201:
 *         description: Cột được tạo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.post("/", authMiddleware, createList);

/**
 * @swagger
 * /api/lists/board/{boardId}:
 *   get:
 *     summary: Lấy tất cả cột thuộc bảng
 *     tags: [Lists]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: boardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của board (phải là ObjectId hợp lệ) 
 *     responses:
 *       200:
 *         description: Danh sách cột
 *       400:
 *         description: Board ID không hợp lệ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.get("/board/:boardId", authMiddleware, getListsByBoard);

/**
 * @swagger
 * /api/lists/{id}:
 *   put:
 *     summary: Cập nhật cột
 *     tags: [Lists]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của list (phải là ObjectId hợp lệ) 
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               position:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy cột 
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.put("/:id", authMiddleware, updateList);

/**
 * @swagger
 * /api/lists/{listId}/update-card-order:
 *   put:
 *     summary: Cập nhật thứ tự thẻ trong cột
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của list (phải là ObjectId hợp lệ)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cardOrder
 *             properties:
 *               cardOrder:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách ID thẻ theo thứ tự mới
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy list
 *       500:
 *         description: Lỗi server
 */
router.put("/:listId/update-card-order", authMiddleware, updateCardOrder);

/**
 * @swagger
 * /api/lists/{id}:
 *   delete:
 *     summary: Xoá cột
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của list (phải là ObjectId hợp lệ) 
 *     responses:
 *       200:
 *         description: Xoá thành công
 *       404:
 *         description: Không tìm thấy cột 
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */ 
router.delete("/:id", authMiddleware, deleteList);

module.exports = router;