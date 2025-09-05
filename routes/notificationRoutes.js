const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middlewares/authMiddleware");

// Cập nhật routes để sử dụng chính xác controller
router.get("/", authMiddleware, notificationController.getNotifications);
router.put("/:id/read", authMiddleware, notificationController.markNotificationAsRead);
router.put("/read-all", authMiddleware, notificationController.markAllNotificationsAsRead);
router.delete("/:id", authMiddleware, notificationController.deleteNotification);
router.delete("/", authMiddleware, notificationController.deleteAllNotifications);

module.exports = router;