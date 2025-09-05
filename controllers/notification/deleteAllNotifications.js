const mongoose = require("mongoose");
const Notification = require("../../models/Notification");

const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    await Notification.updateMany(
      { user: userId, isHidden: false },
      { $set: { isHidden: true } }
    );

    res.status(200).json({ message: "Tất cả thông báo đã được ẩn" });
  } catch (error) {
    console.error("deleteAllNotifications error:", error.message);
    res.status(500).json({ message: "Lỗi khi ẩn tất cả thông báo" });
  }
};

module.exports = deleteAllNotifications;