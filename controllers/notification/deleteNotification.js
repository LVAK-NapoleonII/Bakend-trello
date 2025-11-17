const mongoose = require("mongoose");
const Notification = require("../../models/Notification");
const User = require('../../models/User');

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "ID không hợp lệ" });

    const notification = await Notification.findOneAndDelete({ _id: id, user: req.user._id });
    if (!notification) return res.status(404).json({ message: "Thông báo không tồn tại hoặc không thuộc bạn" });

    await User.updateOne({ _id: req.user._id }, { $pull: { notifications: id } });

    const io = req.app.get("io");
    if (io) io.to(req.user._id.toString()).emit("notification-deleted", { id });

    res.status(200).json({ message: "Đã xóa thông báo" });
  } catch (error) {
    console.error("Delete notification error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = deleteNotification;