const mongoose = require('mongoose');
const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    console.log('getNotifications: Request user:', req.user);
    if (!req.user || !req.user._id) {
      console.error('getNotifications: Missing or invalid user in request');
      return res.status(401).json({ message: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.' });
    }

    const userId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('getNotifications: Invalid user ID:', userId);
      return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
    }
    console.log('getNotifications: Fetching for user:', userId);

    console.log('getNotifications: Fetching raw notifications...');
    const rawNotifications = await Notification.find({
      user: userId,
      isHidden: false
    }).lean();
    console.log('getNotifications: Raw notifications:', JSON.stringify(rawNotifications, null, 2));

    console.log('getNotifications: Populating notifications...');
    const notifications = await Notification.find({
      user: userId,
      isHidden: false
    })
      .sort({ createdAt: -1 })
      .populate([
        {
          path: 'target',
          select: 'title name _id board workspace', // Thêm workspace
          match: { isDeleted: { $ne: true } },
          options: { strictPopulate: false },
        },
        {
          path: 'target',
          populate: {
            path: 'board',
            model: 'Board',
            select: 'title workspace',
            match: { isDeleted: { $ne: true } },
            options: { strictPopulate: false },
            populate: {
              path: 'workspace',
              model: 'Workspace',
              select: '_id name',
              match: { isDeleted: { $ne: true } }
            }
          },
          options: { strictPopulate: false }
        },
        {
          path: 'target',
          populate: {
            path: 'workspace',
            model: 'Workspace',
            select: '_id name',
            match: { isDeleted: { $ne: true } },
            options: { strictPopulate: false }
          },
          options: { strictPopulate: false }
        }
      ])
      .lean();

    console.log('getNotifications: Populated notifications:', JSON.stringify(notifications, null, 2));

    console.log('getNotifications: Filtering valid notifications...');
    const validNotifications = notifications.filter((notification) => {
      if (notification.targetModel === 'Card') {
        if (!notification.target) {
          console.warn('getNotifications: Invalid Card notification, missing target:', notification);
          return false;
        }
        if (!notification.target.board) {
          console.warn('getNotifications: Invalid Card notification, missing board:', notification);
          return false;
        }
        if (!notification.target.board.workspace) {
          console.warn('getNotifications: Invalid Card notification, missing workspace:', notification);
          return false;
        }
      } else if (notification.targetModel === 'Board') {
        if (!notification.target) {
          console.warn('getNotifications: Invalid Board notification, missing target:', notification);
          return false;
        }
        if (!notification.target.workspace) {
          console.warn('getNotifications: Invalid Board notification, missing workspace:', notification);
          return false;
        }
      } else {
        console.warn('getNotifications: Unsupported targetModel:', notification.targetModel, notification);
        return true;
      }
      return true;
    });

    const unreadCount = validNotifications.filter((n) => !n.isRead).length;
    console.log('getNotifications: Found', validNotifications.length, 'valid notifications, unread:', unreadCount);

    res.status(200).json({ notifications: validNotifications, unreadCount });
  } catch (error) {
    console.error('getNotifications: Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    res.status(500).json({ 
      message: 'Lỗi khi lấy thông báo', 
      error: error.message,
      errorName: error.name,
      errorCode: error.code
    });
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
    console.error("markNotificationAsRead: Error:", error);
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
    console.error("markAllNotificationsAsRead: Error:", error);
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
    console.error("deleteNotification: Error:", error);
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
    console.error("deleteAllNotifications: Error:", error);
    res.status(500).json({ message: "Lỗi khi ẩn tất cả thông báo", error: error.message });
  }
};