const express = require("express");
const {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  getDeletedWorkspaces,
  restoreWorkspace,
  leaveWorkspace,
  getPublicWorkspaces,
  joinWorkspace,
} = require("../controllers/workspaceController");
const authMiddleware = require("../middlewares/authMiddleware");
const workspaceMiddleware = require("../middlewares/workspaceMiddleware");
const activityMiddleware = require("../middlewares/activityMiddleware");
const notificationMiddleware = require("../middlewares/notificationMiddleware");

module.exports = (io) => {
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
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 example: "Frontend Team"
   *               description:
   *                 type: string
   *                 example: "Workspace for frontend development"
   *               background:
   *                 type: string
   *                 example: "#ffffff"
   *               isPublic:
   *                 type: boolean
   *                 example: false
   *     responses:
   *       201:
   *         description: Workspace đã được tạo
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                 name:
   *                   type: string
   *                 description:
   *                   type: string
   *                 background:
   *                   type: string
   *                 isPublic:
   *                   type: boolean
   *                 owner:
   *                   type: string
   *                 members:
   *                   type: array
   *                   items:
   *                     type: string
   *                 activities:
   *                   type: array
   *                   items:
   *                     type: string
   *       400:
   *         description: Thiếu tên workspace
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/",
    authMiddleware,
    activityMiddleware("workspace_created", "Workspace", (req) => `User ${req.user.fullName} created workspace "${req.body.name}"`),
    (req, res) => createWorkspace(req, res, io)
  );

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
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   _id:
   *                     type: string
   *                   name:
   *                     type: string
   *                   description:
   *                     type: string
   *                   background:
   *                     type: string
   *                   isPublic:
   *                     type: boolean
   *                   owner:
   *                     type: object
   *                     properties:
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *                   members:
   *                     type: array
   *                     items:
   *                       type: string
   *                   activities:
   *                     type: array
   *                     items:
   *                       type: object
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.get("/", authMiddleware, getWorkspaces);

  /**
   * @swagger
   * /api/workspaces/public:
   *   get:
   *     summary: Lấy danh sách các workspace công khai
   *     tags: [Workspaces]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - name: search
   *         in: query
   *         schema:
   *           type: string
   *         description: Tìm kiếm workspace theo tên
   *     responses:
   *       200:
   *         description: Danh sách workspace công khai
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Workspace'
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.get("/public", authMiddleware, getPublicWorkspaces);

  /**
   * @swagger
   * /api/workspaces/deleted:
   *   get:
   *     summary: Lấy danh sách các workspace đã bị xóa của người dùng (chỉ dành cho owner)
   *     tags: [Workspaces]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Danh sách các workspace đã bị xóa
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   _id:
   *                     type: string
   *                   name:
   *                     type: string
   *                   description:
   *                     type: string
   *                   background:
   *                     type: string
   *                   isPublic:
   *                     type: boolean
   *                   owner:
   *                     type: object
   *                     properties:
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *                   members:
   *                     type: array
   *                     items:
   *                       type: string
   *                   activities:
   *                     type: array
   *                     items:
   *                       type: object
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       500:
   *         description: Lỗi server
   */
  router.get("/deleted", authMiddleware, getDeletedWorkspaces);

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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                 name:
   *                   type: string
   *                 description:
   *                   type: string
   *                 background:
   *                   type: string
   *                 isPublic:
   *                   type: boolean
   *                 owner:
   *                   type: object
   *                   properties:
   *                     email:
   *                       type: string
   *                     fullName:
   *                       type: string
   *                     avatar:
   *                       type: string
   *                 members:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       email:
   *                         type: string
   *                       fullName:
   *                         type: string
   *                       avatar:
   *                         type: string
   *                 activities:
   *                   type: array
   *                   items:
   *                     type: object
   *       400:
   *         description: Workspace ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền truy cập
   *       404:
   *         description: Không tìm thấy workspace
   *       500:
   *         description: Lỗi server
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
   *                 example: "Nhóm phụ trách backend hệ thống APP TEAM"
   *               background:
   *                 type: string
   *                 example: "#ffffff"
   *               isPublic:
   *                 type: boolean
   *                 example: false
   *     responses:
   *       200:
   *         description: Đã cập nhật workspace
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                 name:
   *                   type: string
   *                 description:
   *                   type: string
   *                 background:
   *                   type: string
   *                 isPublic:
   *                   type: boolean
   *                 owner:
   *                   type: string
   *                 members:
   *                   type: array
   *                   items:
   *                     type: string
   *                 activities:
   *                   type: array
   *                   items:
   *                     type: string
   *       400:
   *         description: Workspace ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền cập nhật
   *       404:
   *         description: Không tìm thấy workspace
   *       500:
   *         description: Lỗi server
   */
  router.put(
    "/:id",
    authMiddleware,
    workspaceMiddleware,
    activityMiddleware("workspace_updated", "Workspace", (req) => `User ${req.user.fullName} updated workspace "${req.body.name || 'unknown'}"`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã cập nhật workspace "${req.body.name || 'unknown'}"`,
      "activity",
      "Workspace"
    ),
    (req, res) => updateWorkspace(req, res, io)
  );

  /**
   * @swagger
   * /api/workspaces/{id}:
   *   delete:
   *     summary: Ẩn workspace
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
   *         description: Đã ẩn workspace
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đã ẩn workspace"
   *       400:
   *         description: Workspace ID không hợp lệ
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền ẩn
   *       404:
   *         description: Không tìm thấy workspace
   *       500:
   *         description: Lỗi server
   */
  router.delete(
    "/:id",
    authMiddleware,
    workspaceMiddleware,
    activityMiddleware("workspace_hidden", "Workspace", (req) => `User ${req.user.fullName} hid workspace`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã ẩn workspace`,
      "activity",
      "Workspace"
    ),
    (req, res) => deleteWorkspace(req, res, io)
  );

  /**
   * @swagger
   * /api/workspaces/{id}/restore:
   *   post:
   *     summary: Khôi phục workspace đã bị xóa
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
   *         description: Đã khôi phục workspace
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Đã khôi phục workspace"
   *                 workspace:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     name:
   *                       type: string
   *                     description:
   *                       type: string
   *                     background:
   *                       type: string
   *                     isPublic:
   *                       type: boolean
   *                     owner:
   *                       type: string
   *                     members:
   *                       type: array
   *                       items:
   *                         type: string
   *                     activities:
   *                       type: array
   *                       items:
   *                         type: string
   *       400:
   *         description: Workspace ID không hợp lệ hoặc workspace chưa bị xóa
   *       401:
   *         description: Không có token hoặc token không hợp lệ
   *       403:
   *         description: Không có quyền khôi phục
   *       404:
   *         description: Không tìm thấy workspace
   *       500:
   *         description: Lỗi server
   */
  router.post(
    "/:id/restore",
    authMiddleware,
    workspaceMiddleware,
    activityMiddleware("workspace_restored", "Workspace", (req) => `User ${req.user.fullName} restored workspace`),
    notificationMiddleware(
      (req) => `${req.user.fullName} đã khôi phục workspace`,
      "activity",
      "Workspace"
    ),
    (req, res) => restoreWorkspace(req, res, io)
  );

  /**
 * @swagger
 * /api/workspaces/{id}/leave:
 *   post:
 *     summary: Rời khỏi một workspace
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
 *         description: Đã rời workspace thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã rời workspace thành công"
 *       400:
 *         description: Workspace ID không hợp lệ
 *       401:
 *         description: Không tìm thấy thông tin user
 *       403:
 *         description: Owner không thể rời workspace hoặc không phải thành viên
 *       404:
 *         description: Không tìm thấy workspace
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/:id/leave",
  authMiddleware,
  workspaceMiddleware,
  activityMiddleware("workspace_left", "Workspace", (req) => `User ${req.user.fullName} left workspace`),
  notificationMiddleware(
    (req) => `${req.user.fullName} đã rời workspace`,
    "activity",
    "Workspace"
  ),
  (req, res) => leaveWorkspace(req, res, io)
);

/**
 * @swagger
 * /api/workspaces/{id}/join:
 *   post:
 *     summary: Tham gia một workspace công khai
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
 *         description: Đã tham gia workspace thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã tham gia workspace thành công"
 *                 workspace:
 *                   $ref: '#/components/schemas/Workspace'
 *       400:
 *         description: Workspace ID không hợp lệ hoặc đã là thành viên
 *       401:
 *         description: Không tìm thấy thông tin user
 *       403:
 *         description: Workspace không phải công khai
 *       404:
 *         description: Không tìm thấy workspace
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/:id/join",
  authMiddleware,
  workspaceMiddleware,
  activityMiddleware("workspace_joined", "Workspace", (req) => `User ${req.user.fullName} joined workspace`),
  notificationMiddleware(
    (req) => `${req.user.fullName} đã tham gia workspace`,
    "activity",
    "Workspace"
  ),
  joinWorkspace
);

  return router;
};