const mongoose = require("mongoose");
const Notification = require("../../models/Notification");

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    await Notification.updateMany(
      { user: userId, isRead: false, isHidden: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ message: "Tất cả thông báo đã được đánh dấu là đã đọc" });
  } catch (error) {
    console.error("markAllNotificationsAsRead error:", error.message);
    res.status(500).json({ message: "Lỗi khi đánh dấu tất cả thông báo" });
  }
};

module.exports = markAllNotificationsAsRead;