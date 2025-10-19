const mongoose = require("mongoose");
const Notification = require("../../models/Notification");

const markNotificationAsRead = async (req, res) => {
  try {
    const { id: notificationId } = req.params; // Sử dụng "id" từ route
    const userId = req.user?._id;

    // Kiểm tra userId và notificationId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "User ID không hợp lệ hoặc thiếu!" });
    }
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Notification ID không hợp lệ!" });
    }

    // Tìm và cập nhật thông báo
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId, isHidden: false },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ 
        message: "Thông báo không tồn tại, đã bị ẩn, hoặc không thuộc về bạn" 
      });
    }

    // Gửi sự kiện Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("notification-updated", {
        notificationId,
        isRead: true,
      });
    }

    return res.status(200).json({ 
      message: "Thông báo đã được đánh dấu là đã đọc", 
      notification 
    });
  } catch (error) {
    console.error("markNotificationAsRead error:", {
      message: error.message,
      stack: error.stack,
      notificationId,
      userId,
    });
    return res.status(500).json({ message: "Lỗi server khi đánh dấu thông báo" });
  }
};

module.exports = markNotificationAsRead;