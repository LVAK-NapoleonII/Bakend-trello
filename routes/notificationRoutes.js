const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middlewares/authMiddleware");

// Routes for notifications
router.get("/", authMiddleware, notificationController.getNotifications);
router.put("/:notificationId/read", authMiddleware, notificationController.markNotificationAsRead);
router.put("/read-all", authMiddleware, notificationController.markAllNotificationsAsRead);
router.delete("/:notificationId", authMiddleware, notificationController.deleteNotification);
router.delete("/", authMiddleware, notificationController.deleteAllNotifications);

module.exports = router;