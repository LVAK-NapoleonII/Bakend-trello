const express = require("express");
const {
  createCard,
  getCardsByList,
  updateCard,
  deleteCard,
  addComment,
  addNote,
  addChecklist,
  addChecklistItem,
} = require("../controllers/cardController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cards
 *   description: Quản lý thẻ trong cột
 */

/**
 * @swagger
 * /api/cards:
 *   post:
 *     summary: Tạo thẻ mới
 *     tags: [Cards]
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
 *               - list
 *               - board
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               list:
 *                 type: string
 *                 description: ID của list (phải là ObjectId hợp lệ) 
 *                 example: "507f1f77bcf86cd799439011" 
 *               board:
 *                 type: string
 *                 description: ID của board (phải là ObjectId hợp lệ) 
 *                 example: "507f1f77bcf86cd799439012" 
 *     responses:
 *       201:
 *         description: Tạo thẻ thành công
 *       400:
 *         description: Dữ liệu không hợp lệ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.post("/", authMiddleware, createCard);

/**
 * @swagger
 * /api/cards/list/{listId}:
 *   get:
 *     summary: Lấy các thẻ trong list
 *     tags: [Cards]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của list (phải là ObjectId hợp lệ)
 *     responses:
 *       200:
 *         description: Danh sách thẻ
 *       400:
 *         description: List ID không hợp lệ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.get("/list/:listId", authMiddleware, getCardsByList);

/**
 * @swagger
 * /api/cards/{id}:
 *   put:
 *     summary: Cập nhật thẻ
 *     tags: [Cards]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của card (phải là ObjectId hợp lệ)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy thẻ
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.put("/:id", authMiddleware, updateCard);

/**
 * @swagger
 * /api/cards/{id}:
 *   delete:
 *     summary: Xoá thẻ
 *     tags: [Cards]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của card (phải là ObjectId hợp lệ)
 *     responses:
 *       200:
 *         description: Xoá thành công
 *       404:
 *         description: Không tìm thấy thẻ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.delete("/:id", authMiddleware, deleteCard);

/**
 * @swagger
 * /api/cards/{cardId}/comments:
 *   post:
 *     summary: Thêm bình luận vào thẻ
 *     tags: [Cards]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của card (phải là ObjectId hợp lệ) 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: 
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thêm bình luận thành công
 *       404:
 *         description: Không tìm thấy thẻ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.post("/:cardId/comments", authMiddleware, addComment);

/**
 * @swagger
 * /api/cards/{cardId}/notes:
 *   post:
 *     summary: Thêm ghi chú vào thẻ
 *     tags: [Cards]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của card (phải là ObjectId hợp lệ)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thêm ghi chú thành công
 *       404:
 *         description: Không tìm thấy thẻ
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.post("/:cardId/notes", authMiddleware, addNote);

/**
 * @swagger
 * /api/cards/{cardId}/checklists:
 *   post:
 *     summary: Thêm checklist vào thẻ
 *     tags: [Cards]
 *     security: 
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của card (phải là ObjectId hợp lệ) 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: 
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thêm checklist thành công
 *       404:
 *         description: Không tìm thấy thẻ 
 *       401:
 *         description: Không có token hoặc token không hợp lệ 
 */
router.post("/:cardId/checklists", authMiddleware, addChecklist);

/**
 * @swagger
 * /api/cards/{cardId}/checklists/{checklistIndex}/items:
 *   post:
 *     summary: Thêm item vào checklist của thẻ
 *     tags: [Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của card (phải là ObjectId hợp lệ) 
 *       - in: path
 *         name: checklistIndex
 *         required: true
 *         schema:
 *           type: integer
 *         description: Index của checklist trong mảng checklists
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thêm item vào checklist thành công
 *       404:
 *         description: Không tìm thấy thẻ hoặc checklist 
 *       401:
 *         description: Không có token hoặc token không hợp lệ  
 */
router.post("/:cardId/checklists/:checklistIndex/items", authMiddleware, addChecklistItem);

module.exports = router;