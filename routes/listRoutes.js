const express = require("express");
const {
  createList,
  getListsByBoard,
  updateList,
  deleteList,
  updateCardOrder,
  updateListOrder,
  getListById
} = require("../controllers/listController");
const authMiddleware = require("../middlewares/authMiddleware");
const activityMiddleware = require("../middlewares/activityMiddleware");
const notificationMiddleware = require("../middlewares/notificationMiddleware");

module.exports = (io) => {
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
   *                 example: "To Do"
   *               board:
   *                 type: string
   *                 description: ID của board (phải là ObjectId hợp lệ)
   *                 example: "507f1f77bcf86cd799439011"
   *               position:
   *                 type: number
   *                 example: 0
   *     responses:
   *       201:
   *         description: Cột được tạo thành công
   *       400:
   *         description: Dữ liệu không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền tạo cột
   *       404:
   *         description: Board không tồn tại
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/",
    authMiddleware,
      activityMiddleware("list_created", "List", (req) => `User ${req.user.fullName} created list "${req.body.title}"`),
      notificationMiddleware(
        (req) => `${req.user.fullName} đã tạo list "${req.body.title}" trong board`,
        "activity",
        "List"
      ),
    (req, res) => createList(req, res, io)
  );

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
   *       403:
   *         description: Không có quyền truy cập board
   *       404:
   *         description: Board không tồn tại
   *       500:
   *         description: Lỗi server
   */
  router.get("/board/:boardId", authMiddleware, getListsByBoard);

  /**
   * @swagger
   * /api/lists/card-order/{listId}:
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
   *                 example: ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
   *     responses:
   *       200:
   *         description: Cập nhật thành công
   *       400:
   *         description: Dữ liệu không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền
   *       404:
   *         description: Không tìm thấy list hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/card-order/:listId",
    authMiddleware,
    activityMiddleware("list_cards_reordered", "List", (req) => `User ${req.user.fullName} reordered cards in list`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã sắp xếp lại thẻ trong list`,
      "activity",
      "List"
    ),
    (req, res) => updateCardOrder(req, res, io)
  );

  /**
   * @swagger
   * /api/lists/board/{boardId}/list-order:
   *   put:
   *     summary: Cập nhật thứ tự các cột trong bảng
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - columnOrder
   *             properties:
   *               columnOrder:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Danh sách ID cột theo thứ tự mới
   *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
   *     responses:
   *       200:
   *         description: Cập nhật thành công
   *       400:
   *         description: Dữ liệu không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền
   *       404:
   *         description: Không tìm thấy board
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/board/:boardId/list-order",
    authMiddleware,
    activityMiddleware("board_lists_reordered", "Board", (req) => `User ${req.user.fullName} reordered lists in board`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã sắp xếp lại list trong board`,
      "activity",
      "Board"  
    ),
    (req, res) => updateListOrder(req, res, io)
  );

  /**
   * @swagger
   * /api/lists/{id}:
   *   get:
   *     summary: Lấy thông tin chi tiết của một cột
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
   *         description: Thông tin cột
   *       400:
   *         description: List ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền truy cập
   *       404:
   *         description: Không tìm thấy cột
   *       500:
   *         description: Lỗi server
   */
  router.get("/:id", authMiddleware, (req, res) => {
    // Sửa parameter name để phù hợp với controller
    req.params.listId = req.params.id;
    getListById(req, res);
  });

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
   *                 example: "Updated List"
   *               position:
   *                 type: number
   *                 example: 1
   *     responses:
   *       200:
   *         description: Cập nhật thành công
   *       400:
   *         description: List ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền cập nhật cột
   *       404:
   *         description: Không tìm thấy cột hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:id",
    authMiddleware,
    activityMiddleware("list_updated", "List", (req) => `User ${req.user.fullName} updated list "${req.body.title || 'unknown'}"`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật list "${req.body.title || 'unknown'}"`,
      "activity",
      "List"
    ),
    (req, res) => updateList(req, res, io)
  );

  /**
   * @swagger
   * /api/lists/{id}:
   *   delete:
   *     summary: Ẩn cột
   *     tags: [Lists]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của cột (phải là ObjectId hợp lệ)
   *     responses:
   *       200:
   *         description: Ẩn cột thành công
   *       400:
   *         description: List ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền ẩn cột
   *       404:
   *         description: Không tìm thấy cột hoặc board
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:id",
    authMiddleware,
    activityMiddleware("list_hidden", "List", (req) => `User ${req.user.fullName} hid list`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã ẩn list trong board`,
      "activity",
      "List"
    ),
    (req, res) => deleteList(req, res, io)
  );

  return router;
};