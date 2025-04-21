const Notification = require("../models/Notification");
const User = require("../models/User");

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ 
      user: userId,
      isHidden: false 
    })
      .sort({ createdAt: -1 })
      .populate("target", "name title")
      .lean();

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error("Lỗi khi lấy thông báo:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông báo", error: error.message });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOne({ _id: notificationId, user: userId });
    if (!notification) {
      return res.status(404).json({ message: "Thông báo không tồn tại hoặc không thuộc về bạn" });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: "Thông báo đã được đánh dấu là đã đọc", notification });
  } catch (error) {
    console.error("Lỗi khi đánh dấu thông báo đã đọc:", error);
    res.status(500).json({ message: "Lỗi khi đánh dấu thông báo", error: error.message });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { user: userId, isRead: false, isHidden: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ message: "Tất cả thông báo đã được đánh dấu là đã đọc" });
  } catch (error) {
    console.error("Lỗi khi đánh dấu tất cả thông báo:", error);
    res.status(500).json({ message: "Lỗi khi đánh dấu tất cả thông báo", error: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

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
    console.error("Lỗi khi ẩn thông báo:", error);
    res.status(500).json({ message: "Lỗi khi ẩn thông báo", error: error.message });
  }
};

exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { user: userId, isHidden: false },
      { $set: { isHidden: true } }
    );

    res.status(200).json({ message: "Tất cả thông báo đã được ẩn" });
  } catch (error) {
    console.error("Lỗi khi ẩn tất cả thông báo:", error);
    res.status(500).json({ message: "Lỗi khi ẩn tất cả thông báo", error: error.message });
  }
};