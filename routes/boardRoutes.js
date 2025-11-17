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
  getBoardsByWorkspace,
  getWorkspaceMembers
} = require("../controllers/boardController");
const authMiddleware = require("../middlewares/authMiddleware");
const activityMiddleware = require("../middlewares/activityMiddleware");
const notificationMiddleware = require("../middlewares/notificationMiddleware");

module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * components:
   *   schemas:
   *     Board:
   *       type: object
   *       properties:
   *         _id:
   *           type: string
   *         title:
   *           type: string
   *         description:
   *           type: string
   *         background:
   *           type: string
   *         visibility:
   *           type: string
   *           enum: [public, private]
   *         owner:
   *           $ref: '#/components/schemas/UserBasic'
   *         workspace:
   *           type: object
   *           properties:
   *             _id:
   *               type: string
   *             name:
   *               type: string
   *         members:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               user:
   *                 $ref: '#/components/schemas/User'
   *               isActive:
   *                 type: boolean
   *         invitedUsers:
   *           type: array
   *           items:
   *             type: object
   *             properties:
   *               user:
   *                 $ref: '#/components/schemas/User'
   *               email:
   *                 type: string
   *               isActive:
   *                 type: boolean
   *               invitedAt:
   *                 type: string
   *                 format: date-time
   *         isDeleted:
   *           type: boolean
   *         createdAt:
   *           type: string
   *           format: date-time
   *         updatedAt:
   *           type: string
   *           format: date-time
   *     UserBasic:
   *       type: object
   *       properties:
   *         _id:
   *           type: string
   *         email:
   *           type: string
   *         fullName:
   *           type: string
   *         isOnline:
   *           type: boolean
   *     BoardActivity:
   *       type: object
   *       properties:
   *         _id:
   *           type: string
   *         user:
   *           $ref: '#/components/schemas/UserBasic'
   *         action:
   *           type: object
   *           properties:
   *             category:
   *               type: string
   *             type:
   *               type: string
   *         target:
   *           type: string
   *         targetModel:
   *           type: string
   *         details:
   *           type: string
   *         createdAt:
   *           type: string
   *           format: date-time
   *
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
   *                 minLength: 1
   *                 maxLength: 100
   *                 example: "My New Board"
   *               description:
   *                 type: string
   *                 maxLength: 500
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
   *               $ref: '#/components/schemas/Board'
   *       400:
   *         description: Thiếu title, workspace hoặc workspace ID không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
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
    notificationMiddleware(
      (req) => `${req.user.fullName} đã tạo board "${req.body.title}"`,
      "activity",
      "Board"
    ),
    createBoard
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
   *               type: object
   *               properties:
   *                 boards:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Board'
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
   *           example: "507f1f77bcf86cd799439011"
   *     responses:
   *       200:
   *         description: Thông tin chi tiết bảng
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Board'
   *       400:
   *         description: Board ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền truy cập bảng
   *       404:
   *         description: Không tìm thấy bảng
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
   *         example: "507f1f77bcf86cd799439011"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 100
   *                 example: "Updated Board Title"
   *               description:
   *                 type: string
   *                 maxLength: 500
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
   *               $ref: '#/components/schemas/Board'
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền cập nhật bảng
   *       404:
   *         description: Không tìm thấy bảng
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
    updateBoard
  );

  /**
   * @swagger
   * /api/boards/{id}:
   *   delete:
   *     summary: Ẩn bảng (soft delete)
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
   *         example: "507f1f77bcf86cd799439011"
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
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Chỉ chủ phòng mới có quyền xóa
   *       404:
   *         description: Không tìm thấy bảng
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:id",
    authMiddleware,
  activityMiddleware("board_deleted", "Board", (req) => `User ${req.user.fullName} deleted board`),
  notificationMiddleware(
    (req) => `${req.user.fullName} đã xóa board`,
    "activity",
    "Board"
  ),
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
   *         example: "507f1f77bcf86cd799439011"
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
   *       401:
   *         description: Không có token hoặc token không hợp lệ
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
    activityMiddleware("board_columns_reordered", "Board", (req) => `User ${req.user.fullName} reordered columns`),
      notificationMiddleware(
        (req) => `${req.user.fullName} đã sắp xếp lại cột trong board`,
        "activity",
        "Board"
      ),
    updateColumnOrder
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
   *         example: "507f1f77bcf86cd799439011"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Email của thành viên cần mời
   *                 example: "user@example.com"
   *               userId:
   *                 type: string
   *                 description: ID của thành viên cần mời (ưu tiên hơn email nếu có)
   *                 example: "507f1f77bcf86cd799439011"
   *             oneOf:
   *               - required: [email]
   *               - required: [userId]
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
   *                   $ref: '#/components/schemas/Board'
   *       400:
   *         description: Thiếu email/userId, user đã là thành viên, hoặc ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
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
    inviteMember
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
   *         example: "507f1f77bcf86cd799439011"
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID của thành viên cần vô hiệu hóa
   *         example: "507f1f77bcf86cd799439012"
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
   *                   example: "Đã xóa thành viên khỏi bảng!"
   *                 board:
   *                   $ref: '#/components/schemas/Board'
   *                 cardIds:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Danh sách ID card bị ảnh hưởng
   *       400:
   *         description: ID không hợp lệ hoặc không thể xóa chủ phòng
   *       401:
   *         description: Không có token hoặc token không hợp lệ
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
    removeMember
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
   *         example: "507f1f77bcf86cd799439011"
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *           maximum: 100
   *         description: Số lượng hoạt động tối đa trả về
   *     responses:
   *       200:
   *         description: Danh sách hoạt động
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/BoardActivity'
   *       400:
   *         description: Board ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền truy cập bảng
   *       404:
   *         description: Không tìm thấy bảng
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
   *         example: "507f1f77bcf86cd799439011"
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
   *                   $ref: '#/components/schemas/Board'
   *                 cardIds:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Danh sách ID card bị ảnh hưởng
   *                 redirect:
   *                   type: string
   *                   example: "/boards"
   *       400:
   *         description: Chủ phòng không thể rời bảng hoặc Board ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không phải thành viên của bảng
   *       404:
   *         description: Không tìm thấy bảng
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
    leaveBoard
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
   *         example: "507f1f77bcf86cd799439011"
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
   *                 example: "507f1f77bcf86cd799439012"
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
   *                   $ref: '#/components/schemas/Board'
   *       400:
   *         description: ID không hợp lệ hoặc user không phải thành viên
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Chỉ chủ phòng mới có quyền chuyển quyền
   *       404:
   *         description: Không tìm thấy bảng hoặc user
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
    transferOwnership
  );
  router.get("/workspace/:workspaceId", authMiddleware, getBoardsByWorkspace);
  router.get("/workspace/:workspaceId/members", authMiddleware, getWorkspaceMembers);

  return router;
};