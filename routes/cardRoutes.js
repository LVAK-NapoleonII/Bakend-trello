const express = require("express");
const {
  getCardById,
  createCard,
  getCardsByList,
  updateCard,
  deleteCard,
  moveCard,
  addMember,
  toggleCardCompletion,
  removeMemberFromCard,
} = require("../controllers/cardController");
const { addComment,hideComment } = require("../controllers/commentController");
const { addNote,hideNote } = require("../controllers/noteController");
const {
  addChecklist,
  addChecklistItem,
  toggleChecklistItem,
  editChecklist,
  deleteChecklist,
  editChecklistItem,
  deleteChecklistItem,
} = require("../controllers/checklistController");
const authMiddleware = require("../middlewares/authMiddleware");
const activityMiddleware = require("../middlewares/activityMiddleware");
const notificationMiddleware = require("../middlewares/notificationMiddleware");

module.exports = (io) => {
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
   *                 example: "New Task"
   *               description:
   *                 type: string
   *                 example: "Task description"
   *               list:
   *                 type: string
   *                 description: ID của list (phải là ObjectId hợp lệ)
   *                 example: "507f1f77bcf86cd799439011"
   *               board:
   *                 type: string
   *                 description: ID của board (phải là ObjectId hợp lệ)
   *                 example: "507f1f77bcf86cd799439012"
   *               position:
   *                 type: number
   *                 description: Vị trí của thẻ trong list
   *                 example: 0
   *     responses:
   *       201:
   *         description: Tạo thẻ thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Card'
   *       400:
   *         description: Thiếu title, list, board hoặc ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền tạo thẻ trong board
   *       404:
   *         description: List hoặc board không tồn tại
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/",
    authMiddleware,
    activityMiddleware("card_created", "Card", (req) => `User ${req.user.fullName} created card "${req.body.title}"`),
    (req, res) => createCard(req, res, io)
  );

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
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Card'
   *       400:
   *         description: List ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền truy cập list
   *       404:
   *         description: List không tồn tại
   *       500:
   *         description: Lỗi server
   */
  router.get("/list/:listId", authMiddleware, getCardsByList);

  /**
   * @swagger
   * /api/cards/{id}:
   *   get:
   *     summary: Lấy thông tin chi tiết thẻ
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Thông tin chi tiết thẻ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Card'
   *       400:
   *         description: Card ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền truy cập thẻ
   *       404:
   *         description: Không tìm thấy thẻ hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.get("/:id", authMiddleware, getCardById);

  /**
   * @swagger
   * /api/cards/{id}:
   *   put:
   *     summary: Cập nhật thông tin thẻ
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *                 example: "Updated Task"
   *               description:
   *                 type: string
   *                 example: "Updated description"
   *               dueDate:
   *                 type: string
   *                 format: date-time
   *                 example: "2023-12-31T23:59:59Z"
   *               cover:
   *                 type: string
   *                 example: "#FF0000"
   *     responses:
   *       200:
   *         description: Cập nhật thẻ thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Card'
   *       400:
   *         description: Card ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền cập nhật thẻ
   *       404:
   *         description: Không tìm thấy thẻ hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:id",
    authMiddleware,
    activityMiddleware("card_updated", "Card", (req) => `User ${req.user.fullName} updated card "${req.body.title || 'unknown'}"`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật card "${req.body.title || 'unknown'}"`,
      "activity",
      "Card"
    ),
    (req, res) => updateCard(req, res, io)
  );

  /**
   * @swagger
   * /api/cards/{id}/complete:
   *   put:
   *     summary: Đánh dấu hoàn thành/không hoàn thành thẻ
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Cập nhật trạng thái hoàn thành thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Cập nhật trạng thái hoàn thành thẻ thành công"
   *                 card:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     title:
   *                       type: string
   *                     completed:
   *                       type: boolean
   *       400:
   *         description: Card ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền cập nhật trạng thái thẻ
   *       404:
   *         description: Không tìm thấy thẻ hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:id/complete",
    authMiddleware,
    activityMiddleware(
      "card_completion_toggled",
      "Card",
      (req) => `User ${req.user.fullName} toggled completion of card`
    ),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật trạng thái hoàn thành của card`,
      "activity",
      "Card"
    ),
    (req, res) => toggleCardCompletion(req, res, io)
  );

  /**
   * @swagger
   * /api/cards/{id}:
   *   delete:
   *     summary: Ẩn thẻ
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Ẩn thẻ thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đã ẩn thẻ"
   *       400:
   *         description: Card ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền ẩn thẻ
   *       404:
   *         description: Không tìm thấy thẻ hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:id",
    authMiddleware,
    activityMiddleware("card_hidden", "Card", (req) => `User ${req.user.fullName} hid card`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã ẩn card`,
      "activity",
      "Card"
    ),
    (req, res) => deleteCard(req, res, io)
  );

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
   *                 example: "This is a comment"
   *     responses:
   *       200:
   *         description: Thêm bình luận thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Comment'
   *       400:
   *         description: Thiếu text hoặc card ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền bình luận
   *       404:
   *         description: Không tìm thấy thẻ
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/:cardId/comments",
    authMiddleware,
    activityMiddleware("comment_added", "Card", (req) => `User ${req.user.fullName} added a comment to card`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã bình luận trên card`,
      "activity",
      "Card"
    ),
    (req, res) => addComment(req, res, io)
  );

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
   *                 example: "This is a note"
   *     responses:
   *       200:
   *         description: Thêm ghi chú thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Note'
   *       400:
   *         description: Thiếu content hoặc card ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền thêm ghi chú
   *       404:
   *         description: Không tìm thấy thẻ
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/:cardId/notes",
    authMiddleware,
    activityMiddleware("note_added", "Card", (req) => `User ${req.user.fullName} added a note to card`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã thêm ghi chú vào card`,
      "activity",
      "Card"
    ),
    (req, res) => addNote(req, res, io)
  );

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
   *                 example: "Checklist Title"
   *     responses:
   *       200:
   *         description: Thêm checklist thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Checklist'
   *       400:
   *         description: Thiếu title hoặc card ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền thêm checklist
   *       404:
   *         description: Không tìm thấy thẻ
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/:cardId/checklists",
    authMiddleware,
    activityMiddleware("checklist_added", "Card", (req) => `User ${req.user.fullName} added a checklist to card`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã thêm checklist vào card`,
      "activity",
      "Card"
    ),
    (req, res) => addChecklist(req, res, io)
  );

 /**
   * @swagger
   * /api/cards/{cardId}/checklists/{checklistId}:
   *   put:
   *     summary: Sửa tiêu đề checklist
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: checklistId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của checklist (phải là ObjectId hợp lệ)
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
   *                 example: "Updated Checklist Title"
   *     responses:
   *       200:
   *         description: Cập nhật checklist thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Checklist'
   *       400:
   *         description: Thiếu title hoặc ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền sửa checklist
   *       404:
   *         description: Không tìm thấy thẻ hoặc checklist
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:cardId/checklists/:checklistId",
    authMiddleware,
    activityMiddleware(
      "checklist_updated",
      "Card",
      (req) => `User ${req.user.fullName} updated checklist "${req.body.title}"`
    ),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật checklist "${req.body.title}"`,
      "activity",
      "Card"
    ),
    (req, res) => editChecklist(req, res, io)
  );

 /**
   * @swagger
   * /api/cards/{cardId}/checklists/{checklistId}:
   *   delete:
   *     summary: Xóa checklist
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: checklistId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của checklist (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Xóa checklist thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Checklist'
   *       400:
   *         description: ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền xóa checklist
   *       404:
   *         description: Không tìm thấy thẻ hoặc checklist
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:cardId/checklists/:checklistId",
    authMiddleware,
    activityMiddleware(
      "checklist_deleted",
      "Card",
      (req) => `User ${req.user.fullName} deleted a checklist`
    ),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã xóa một checklist`,
      "activity",
      "Card"
    ),
    (req, res) => deleteChecklist(req, res, io)
  );

 /**
   * @swagger
   * /api/cards/{cardId}/checklists/{checklistId}/items:
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
   *         name: checklistId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của checklist (phải là ObjectId hợp lệ)
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
   *                 example: "Checklist item"
   *     responses:
   *       200:
   *         description: Thêm item vào checklist thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Checklist'
   *       400:
   *         description: Thiếu text hoặc ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền thêm item
   *       404:
   *         description: Không tìm thấy thẻ hoặc checklist
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/:cardId/checklists/:checklistId/items",
    authMiddleware,
    activityMiddleware("checklist_item_added", "Card", (req) => `User ${req.user.fullName} added a checklist item`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã thêm item vào checklist của card`,
      "activity",
      "Card"
    ),
    (req, res) => addChecklistItem(req, res, io)
  );

 /**
   * @swagger
   * /api/cards/{cardId}/checklists/{checklistId}/items/{itemId}:
   *   put:
   *     summary: Sửa nội dung checklist item
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: checklistId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của checklist (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của item (phải là ObjectId hợp lệ)
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
   *                 example: "Updated checklist item"
   *     responses:
   *       200:
   *         description: Cập nhật checklist item thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Checklist'
   *       400:
   *         description: Thiếu text hoặc ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền sửa checklist item
   *       404:
   *         description: Không tìm thấy thẻ, checklist, hoặc item
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:cardId/checklists/:checklistId/items/:itemId",
    authMiddleware,
    activityMiddleware(
      "checklist_item_updated",
      "Card",
      (req) => `User ${req.user.fullName} updated a checklist item to "${req.body.text}"`
    ),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật item "${req.body.text}" trong checklist`,
      "activity",
      "Card"
    ),
    (req, res) => editChecklistItem(req, res, io)
  );

/**
   * @swagger
   * /api/cards/{cardId}/checklists/{checklistId}/items/{itemId}:
   *   delete:
   *     summary: Xóa checklist item
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: checklistId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của checklist (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của item (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Xóa checklist item thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Checklist'
   *       400:
   *         description: ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền xóa checklist item
   *       404:
   *         description: Không tìm thấy thẻ, checklist, hoặc item
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:cardId/checklists/:checklistId/items/:itemId",
    authMiddleware,
    activityMiddleware(
      "checklist_item_deleted",
      "Card",
      (req) => `User ${req.user.fullName} deleted a checklist item`
    ),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã xóa một item trong checklist`,
      "activity",
      "Card"
    ),
    (req, res) => deleteChecklistItem(req, res, io)
  );

  /**
   * @swagger
   * /api/cards/{cardId}/checklists/{checklistId}/items/{itemId}/toggle:
   *   put:
   *     summary: Đánh dấu hoàn thành/không hoàn thành item trong checklist
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
   *         name: checklistId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của checklist (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của item (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Cập nhật trạng thái item thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Checklist'
   *       400:
   *         description: ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền cập nhật checklist
   *       404:
   *         description: Không tìm thấy thẻ, checklist, hoặc item
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:cardId/checklists/:checklistId/items/:itemId/toggle",
    authMiddleware,
    activityMiddleware("checklist_item_toggled", "Card", (req) => `User ${req.user.fullName} toggled a checklist item`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật trạng thái checklist item trong card`,
      "activity",
      "Card"
    ),
    (req, res) => toggleChecklistItem(req, res, io)
  );

  /**
   * @swagger
   * /api/cards/{cardId}/move:
   *   put:
   *     summary: Di chuyển thẻ trong cùng cột hoặc sang cột/bảng khác
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - newListId
   *               - newBoardId
   *             properties:
   *               newListId:
   *                 type: string
   *                 description: ID của cột mới (phải là ObjectId hợp lệ)
   *                 example: "507f1f77bcf86cd799439013"
   *               newBoardId:
   *                 type: string
   *                 description: ID của bảng mới (phải là ObjectId hợp lệ)
   *                 example: "507f1f77bcf86cd799439014"
   *               newPosition:
   *                 type: number
   *                 description: Vị trí mới của thẻ trong cột (tùy chọn)
   *                 example: 0
   *     responses:
   *       200:
   *         description: Di chuyển thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Di chuyển thẻ thành công"
   *                 card:
   *                   $ref: '#/components/schemas/Card'
   *       400:
   *         description: Card ID, list ID, hoặc board ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền di chuyển thẻ
   *       404:
   *         description: Không tìm thấy thẻ, cột, hoặc bảng
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:cardId/move",
    authMiddleware,
    activityMiddleware("card_moved", "Card", (req) => `User ${req.user.fullName} moved card`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã di chuyển card`,
      "activity",
      "Card"
    ),
    (req, res) => moveCard(req, res, io)
  );

  /**
   * @swagger
   * /api/cards/{cardId}/members:
   *   post:
   *     summary: Thêm thành viên vào thẻ
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - memberId
   *             properties:
   *               memberId:
   *                 type: string
   *                 description: ID của thành viên (phải là ObjectId hợp lệ)
   *                 example: "507f1f77bcf86cd799439015"
   *     responses:
   *       200:
   *         description: Thêm thành viên thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Card'
   *       400:
   *         description: Card ID hoặc member ID không hợp lệ, hoặc member đã trong thẻ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền thêm thành viên
   *       404:
   *         description: Không tìm thấy thẻ hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/:cardId/members",
    authMiddleware,
    activityMiddleware("member_added", "Card", (req) => `User ${req.user.fullName} added a member to card`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã thêm bạn vào card`,
      "activity",
      "Card"
    ),
    (req, res) => addMember(req, res, io)
  );

  /**
   * @swagger
   * /api/cards/{cardId}/members/{memberId}:
   *   delete:
   *     summary: Xóa thành viên khỏi thẻ
   *     tags: [Cards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: cardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thẻ (phải là ObjectId hợp lệ)
   *       - in: path
   *         name: memberId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thành viên (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Xóa thành viên khỏi thẻ thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   _id:
   *                     type: string
   *                   email:
   *                     type: string
   *                   fullName:
   *                     type: string
   *                   avatar:
   *                     type: string
   *       400:
   *         description: Card ID hoặc member ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền xóa thành viên
   *       404:
   *         description: Không tìm thấy thẻ hoặc thành viên
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:cardId/members/:memberId",
    authMiddleware,
    activityMiddleware("member_removed_from_card", "Card", (req) => `User ${req.user.fullName} removed a member from card`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã xóa một thành viên khỏi card`,
      "activity",
      "Card"
    ),
    (req, res) => removeMemberFromCard(req, res, io)
  );
/**
 * @swagger
 * /api/cards/{cardId}/comments/{commentId}:
 *   delete:
 *     summary: Thu hồi bình luận
 *     tags: [Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thẻ (phải là ObjectId hợp lệ)
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bình luận (phải là ObjectId hợp lệ)
 *     responses:
 *       200:
 *         description: Thu hồi bình luận thành công
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền thu hồi bình luận
 *       404:
 *         description: Không tìm thấy thẻ hoặc bình luận
 *       500:
 *         description: Lỗi server
 */
router.delete(
  "/:cardId/comments/:commentId",
  authMiddleware,
  activityMiddleware("comment_hidden", "Card", (req) => `User ${req.user.fullName} hid a comment`),
  notificationMiddleware(
    (req) => `${req.user.fullName} đã thu hồi một bình luận`,
    "activity",
    "Card"
  ),
  (req, res) => hideComment(req, res, io)
);

/**
 * @swagger
 * /api/cards/{cardId}/notes/{noteId}:
 *   delete:
 *     summary: Thu hồi ghi chú
 *     tags: [Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thẻ (phải là ObjectId hợp lệ)
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của ghi chú (phải là ObjectId hợp lệ)
 *     responses:
 *       200:
 *         description: Thu hồi ghi chú thành công
 *       400:
 *         description: ID không hợp lệ
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền thu hồi ghi chú
 *       404:
 *         description: Không tìm thấy thẻ hoặc ghi chú
 *       500:
 *         description: Lỗi server
 */
router.delete(
  "/:cardId/notes/:noteId",
  authMiddleware,
  activityMiddleware("note_hidden", "Card", (req) => `User ${req.user.fullName} hid a note`),
  notificationMiddleware(
    (req) => `${req.user.fullName} đã thu hồi một ghi chú`,
    "activity",
    "Card"
  ),
  (req, res) => hideNote(req, res, io)
);
  /**
   * @swagger
   * components:
   *   schemas:
   *     Card:
   *       type: object
   *       properties:
   *         _id:
   *           type: string
   *         title:
   *           type: string
   *         description:
   *           type: string
   *         list:
   *           type: string
   *         board:
   *           type: string
   *         members:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               _id:
   *                 type: string
   *               email:
   *                 type: string
   *               fullName:
   *                 type: string
   *               avatar:
   *                 type: string
   *         cover:
   *           type: string
   *         dueDate:
   *           type: string
   *           format: date-time
   *         completed:
   *           type: boolean
   *         position:
   *           type: number
   *         checklists:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/Checklist'
   *         comments:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/Comment'
   *         notes:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/Note'
   *         activities:
   *           type: array
   *           items:
   *             type: string
   *         isDeleted:
   *           type: boolean
   *     Checklist:
   *       type: object
   *       properties:
   *         title:
   *           type: string
   *         items:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               text:
   *                 type: string
   *               completed:
   *                 type: boolean
   *     Comment:
   *       type: object
   *       properties:
   *         user:
   *           type: object
   *           properties:
   *             _id:
   *               type: string
   *             email:
   *               type: string
   *             fullName:
   *               type: string
   *         text:
   *           type: string
   *         createdAt:
   *           type: string
   *           format: date-time
   *     Note:
   *       type: object
   *       properties:
   *         content:
   *           type: string
   *         createdBy:
   *           type: object
   *           properties:
   *             _id:
   *               type: string
   *             email:
   *               type: string
   *             fullName:
   *               type: string
   *         createdAt:
   *           type: string
   *           format: date-time
   */

  return router;
};