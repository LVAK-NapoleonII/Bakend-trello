const mongoose = require("mongoose");
const Notification = require("../../models/Notification");

const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Notification ID hoặc user ID không hợp lệ!" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { $set: { isHidden: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Thông báo không tồn tại hoặc không thuộc về bạn" });
    }

    res.status(200).json({ message: "Thông báo đã được ẩn" });
  } catch (error) {
    console.error("deleteNotification error:", error.message);
    res.status(500).json({ message: "Lỗi khi ẩn thông báo" });
  }
};

module.exports = deleteNotification;