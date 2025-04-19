const Notification = require("../models/Notification");

const getNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const notifications = await Notification.find({ user: req.user._id })
      .populate("user", "fullName email")
      .populate({
        path: "target",
        select: "title name",
        match: { targetModel: { $in: ["Workspace", "Board", "List", "Card"] } },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json(notifications);
  } catch (err) {
    console.error("Error in getNotifications:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ message: "Không tìm thấy thông báo!" });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: "Đã đánh dấu thông báo là đã đọc!" });
  } catch (err) {
    console.error("Error in markNotificationAsRead:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({ message: "Đã đánh dấu tất cả thông báo là đã đọc!" });
  } catch (err) {
    console.error("Error in markAllNotificationsAsRead:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};


module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};