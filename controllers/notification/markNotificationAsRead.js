const mongoose = require("mongoose");
const Notification = require("../../models/Notification");

const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Notification ID hoặc user ID không hợp lệ!" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Thông báo không tồn tại hoặc không thuộc về bạn" });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("notification-updated", {
        notificationId,
        isRead: true
      });
    }

    res.status(200).json({ message: "Thông báo đã được đánh dấu là đã đọc", notification });
  } catch (error) {
    console.error("markNotificationAsRead error:", {
      message: error.message,
      stack: error.stack,
      notificationId,
      userId
    });
    res.status(500).json({ message: "Lỗi khi đánh dấu thông báo" });
  }
};

module.exports = markNotificationAsRead;