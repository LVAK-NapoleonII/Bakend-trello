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
  activityMiddleware("workspace_hidden", "Workspace", (req) => `User ${req.user.fullName} hid workspace`), // Cập nhật action
  notificationMiddleware(
    (req) => `${req.user.fullName} đã ẩn workspace`, // Cập nhật thông điệp
    "activity",
    "Workspace"
  ),
  (req, res) => deleteWorkspace(req, res, io)
);

  return router;
};