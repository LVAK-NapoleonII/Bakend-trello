const express = require("express");
const {
  createBoard,
  getUserBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
  updateColumnOrder,
  inviteMember,
  removeMember,
  getBoardActivities,
  leaveBoard,
  transferOwnership,
} = require("../controllers/boardController");
const authMiddleware = require("../middlewares/authMiddleware");
const activityMiddleware = require("../middlewares/activityMiddleware");
const notificationMiddleware = require("../middlewares/notificationMiddleware");
const User = require("../models/User")

module.exports = (io) => {
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
   *                 example: "My New Board"
   *               description:
   *                 type: string
   *                 example: "A board for project management"
   *               background:
   *                 type: string
   *                 example: "#f0f0f0"
   *               visibility:
   *                 type: string
   *                 enum: [public, private]
   *                 default: public
   *               workspace:
   *                 type: string
   *                 description: ID của workspace (phải là ObjectId hợp lệ)
   *                 example: "507f1f77bcf86cd799439011"
   *     responses:
   *       201:
   *         description: Tạo bảng thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                 title:
   *                   type: string
   *                 description:
   *                   type: string
   *                 background:
   *                   type: string
   *                 visibility:
   *                   type: string
   *                 owner:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     email:
   *                       type: string
   *                     fullName:
   *                       type: string
   *                 workspace:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     name:
   *                       type: string
   *                 members:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *       400:
   *         description: Thiếu title, workspace hoặc workspace ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền tạo board trong workspace
   *       404:
   *         description: Workspace không tồn tại
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/",
    authMiddleware,
    activityMiddleware("board_created", "Board", (req) => `User ${req.user.fullName} created board "${req.body.title}"`),
    (req, res) => createBoard(req, res, io)
  );

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
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   _id:
   *                     type: string
   *                   title:
   *                     type: string
   *                   description:
   *                     type: string
   *                   background:
   *                     type: string
   *                   visibility:
   *                     type: string
   *                   owner:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                   workspace:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       name:
   *                         type: string
   *                   members:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         _id:
   *                           type: string
   *                         email:
   *                           type: string
   *                         fullName:
   *                           type: string
   *                         avatar:
   *                           type: string
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
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
   *         description: Thông tin chi tiết bảng
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                 title:
   *                   type: string
   *                 description:
   *                   type: string
   *                 background:
   *                   type: string
   *                 visibility:
   *                   type: string
   *                 owner:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     email:
   *                       type: string
   *                     fullName:
   *                       type: string
   *                 workspace:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     name:
   *                       type: string
   *                 members:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *                 invitedUsers:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *       403:
   *         description: Không có quyền truy cập bảng
   *       404:
   *         description: Không tìm thấy bảng
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
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
   *                 example: "Updated Board Title"
   *               description:
   *                 type: string
   *                 example: "Updated description"
   *               background:
   *                 type: string
   *                 example: "#00ff00"
   *               visibility:
   *                 type: string
   *                 enum: [public, private]
   *     responses:
   *       200:
   *         description: Cập nhật thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                 title:
   *                   type: string
   *                 description:
   *                   type: string
   *                 background:
   *                   type: string
   *                 visibility:
   *                   type: string
   *                 owner:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     email:
   *                       type: string
   *                     fullName:
   *                       type: string
   *                 workspace:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     name:
   *                       type: string
   *                 members:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *       403:
   *         description: Không có quyền cập nhật bảng
   *       404:
   *         description: Không tìm thấy bảng
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:id",
    authMiddleware,
    activityMiddleware("board_updated", "Board", (req) => `User ${req.user.fullName} updated board "${req.body.title || 'unknown'}"`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật board "${req.body.title || 'unknown'}"`,
      "activity",
      "Board"
    ),
    (req, res) => updateBoard(req, res, io)
  );

  /**
   * @swagger
   * /api/boards/{id}:
   *   delete:
   *     summary: Ẩn bảng
   *     tags: [Boards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID bảng cần ẩn
   *     responses:
   *       200:
   *         description: Ẩn bảng thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đã ẩn bảng thành công"
   *       403:
   *         description: Chỉ chủ phòng mới có quyền xóa
   *       404:
   *         description: Không tìm thấy bảng
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:id",
    authMiddleware,
    activityMiddleware("board_deleted", "Board", (req) => `User ${req.user.fullName} deleted board`),
    (req, res) => deleteBoard(req, res, io)
  );

  /**
   * @swagger
   * /api/boards/{boardId}/column-order:
   *   put:
   *     summary: Cập nhật thứ tự cột trong bảng
   *     tags: [Boards]
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Cập nhật thứ tự cột thành công"
   *       400:
   *         description: Board ID hoặc columnOrder không hợp lệ
   *       403:
   *         description: Không có quyền cập nhật board
   *       404:
   *         description: Không tìm thấy board
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:boardId/column-order",
    authMiddleware,
    activityMiddleware("column_order_updated", "Board", (req) => `User ${req.user.fullName} updated column order`),
    (req, res) => updateColumnOrder(req, res, io)
  );

  /**
   * @swagger
   * /api/boards/{boardId}/invite:
   *   post:
   *     summary: Mời thành viên mới vào bảng
   *     tags: [Boards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: boardId
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
   *               email:
   *                 type: string
   *                 description: Email của thành viên cần mời
   *                 example: "user@example.com"
   *               userId:
   *                 type: string
   *                 description: ID của thành viên cần mời (tùy chọn, ưu tiên hơn email)
   *                 example: "507f1f77bcf86cd799439011"
   *     responses:
   *       200:
   *         description: Mời thành viên thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đã mời thành viên thành công!"
   *                 board:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     title:
   *                       type: string
   *                     members:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           email:
   *                             type: string
   *                           fullName:
   *                             type: string
   *                           avatar:
   *                             type: string
   *                     invitedUsers:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           email:
   *                             type: string
   *                           fullName:
   *                             type: string
   *                           avatar:
   *                             type: string
   *       400:
   *         description: Thiếu email/userId, user đã là thành viên, hoặc ID không hợp lệ
   *       403:
   *         description: Không có quyền mời thành viên (chỉ owner)
   *       404:
   *         description: Không tìm thấy bảng hoặc user
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/:boardId/invite",
    authMiddleware,
    activityMiddleware("member_invited", "Board", (req) => `User ${req.user.fullName} invited a member to board`),
    notificationMiddleware(
      (req) => `Bạn đã được mời vào board bởi ${req.user.fullName}`,
      "activity",
      "Board"
    ),
    (req, res) => inviteMember(req, res, io)
  );

  /**
   * @swagger
   * /api/boards/{boardId}/members/{userId}:
   *   delete:
   *     summary: Vô hiệu hóa thành viên trong bảng
   *     tags: [Boards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: boardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của bảng
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thành viên cần vô hiệu hóa
   *     responses:
   *       200:
   *         description: Vô hiệu hóa thành viên thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đã vô hiệu hóa thành viên trong bảng!"
   *                 board:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     title:
   *                       type: string
   *                     members:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           email:
   *                             type: string
   *                           fullName:
   *                             type: string
   *                           avatar:
   *                             type: string
   *       400:
   *         description: ID không hợp lệ hoặc không thể xóa chủ phòng
   *       403:
   *         description: Chỉ chủ phòng mới có quyền xóa thành viên
   *       404:
   *         description: Không tìm thấy bảng hoặc user
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:boardId/members/:userId",
    authMiddleware,
    activityMiddleware("member_removed", "Board", (req) => `User ${req.user.fullName} removed a member from board`),
    notificationMiddleware(
      (req) => `Bạn đã bị xóa khỏi board bởi ${req.user.fullName}`,
      "activity",
      "Board"
    ),
    (req, res) => removeMember(req, res, io)
  );

  /**
   * @swagger
   * /api/boards/{boardId}/activities:
   *   get:
   *     summary: Lấy danh sách hoạt động của bảng
   *     tags: [Boards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: boardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của bảng
   *     responses:
   *       200:
   *         description: Danh sách hoạt động
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   _id:
   *                     type: string
   *                   user:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                   action:
   *                     type: string
   *                   target:
   *                     type: string
   *                   targetModel:
   *                     type: string
   *                   details:
   *                     type: string
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   *       403:
   *         description: Không có quyền truy cập bảng
   *       404:
   *         description: Không tìm thấy bảng
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.get("/:boardId/activities", authMiddleware, getBoardActivities);

  /**
   * @swagger
   * /api/boards/{boardId}/leave:
   *   delete:
   *     summary: Rời khỏi bảng
   *     tags: [Boards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: boardId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của bảng
   *     responses:
   *       200:
   *         description: Rời bảng thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đã rời khỏi bảng thành công!"
   *                 board:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     title:
   *                       type: string
   *                     members:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           email:
   *                             type: string
   *                           fullName:
   *                             type: string
   *                           avatar:
   *                             type: string
   *       400:
   *         description: Chủ phòng không thể rời bảng
   *       403:
   *         description: Không phải thành viên của bảng
   *       404:
   *         description: Không tìm thấy bảng
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:boardId/leave",
    authMiddleware,
    activityMiddleware("member_left", "Board", (req) => `User ${req.user.fullName} left the board`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã rời khỏi board`,
      "activity",
      "Board"
    ),
    (req, res) => leaveBoard(req, res, io)
  );

  /**
   * @swagger
   * /api/boards/{boardId}/transfer:
   *   put:
   *     summary: Chuyển quyền sở hữu bảng
   *     tags: [Boards]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: boardId
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
   *             required:
   *               - newOwnerId
   *             properties:
   *               newOwnerId:
   *                 type: string
   *                 description: ID của thành viên sẽ trở thành chủ mới
   *                 example: "507f1f77bcf86cd799439011"
   *     responses:
   *       200:
   *         description: Chuyển quyền sở hữu thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Chuyển quyền sở hữu thành công!"
   *                 board:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     title:
   *                       type: string
   *                     owner:
   *                       type: object
   *                       properties:
   *                         _id:
   *                           type: string
   *                         email:
   *                           type: string
   *                         fullName:
   *                           type: string
   *                     members:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           _id:
   *                             type: string
   *                           email:
   *                             type: string
   *                           fullName:
   *                             type: string
   *                           avatar:
   *                             type: string
   *       400:
   *         description: ID không hợp lệ hoặc user không phải thành viên
   *       403:
   *         description: Chỉ chủ phòng mới có quyền chuyển quyền
   *       404:
   *         description: Không tìm thấy bảng hoặc user
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:boardId/transfer",
    authMiddleware,
    activityMiddleware("board_ownership_transferred", "Board", (req) => `User ${req.user.fullName} transferred ownership`),
    notificationMiddleware(
      (req) => `Bạn đã được chuyển quyền sở hữu board bởi ${req.user.fullName}`,
      "activity",
      "Board"
    ),
    (req, res) => transferOwnership(req, res, io)
  );

  return router;
};