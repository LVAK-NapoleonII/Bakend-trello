const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const User = require("../models/User");

exports.getActivities = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
    }
    console.log('getActivities: Fetching for user:', userId, 'Page:', page, 'Limit:', limit);

    const activities = await Activity.find({ 
      user: userId,
      isHidden: false 
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate([
        {
          path: 'target',
          select: 'name title board',
          match: { isDeleted: { $ne: true } },
        },
        {
          path: 'target',
          match: { isDeleted: { $ne: true }, targetModel: 'Card' }, // Chỉ populate board cho Card
          populate: {
            path: 'board',
            model: 'Board',
            select: 'workspace',
            match: { isDeleted: { $ne: true } },
            populate: {
              path: 'workspace',
              model: 'Workspace',
              select: '_id',
              match: { isDeleted: { $ne: true } },
            },
          },
        },
      ])
      .lean();

    const validActivities = activities.filter((activity) => {
      if (activity.targetModel === 'Card') {
        if (!activity.target || !activity.target.board || !activity.target.board.workspace) {
          console.warn('getActivities: Invalid activity, missing target data:', activity);
          return false;
        }
      }
      return true;
    });

    console.log('getActivities: Found', validActivities.length, 'valid activities');
    res.status(200).json({ activities: validActivities });
  } catch (error) {
    console.error('getActivities: Detailed error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user._id,
      query: req.query,
    });
    res.status(500).json({ message: 'Lỗi khi lấy hoạt động', error: error.message });
  }
};

exports.hideActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.user._id;

    const activity = await Activity.findOneAndUpdate(
      { _id: activityId, user: userId },
      { $set: { isHidden: true } },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json({ message: "Hoạt động không tồn tại hoặc không thuộc về bạn" });
    }

    res.status(200).json({ message: "Hoạt động đã được ẩn" });
  } catch (error) {
    console.error("Lỗi khi ẩn hoạt động:", error);
    res.status(500).json({ message: "Lỗi khi ẩn hoạt động", error: error.message });
  }
};

exports.hideAllActivities = async (req, res) => {
  try {
    const userId = req.user._id;

    await Activity.updateMany(
      { user: userId, isHidden: false },
      { $set: { isHidden: true } }
    );

    res.status(200).json({ message: "Tất cả hoạt động đã được ẩn" });
  } catch (error) {
    console.error("Lỗi khi ẩn tất cả hoạt động:", error);
    res.status(500).json({ message: "Lỗi khi ẩn tất cả hoạt động", error: error.message });
  }
};