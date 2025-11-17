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

    // Tách riêng populate cho từng targetModel
    const baseQuery = {
      user: userId,
      isHidden: false
    };

    const activities = await Activity.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Populate thủ công theo targetModel
    const populatedActivities = await Promise.all(
      activities.map(async (activity) => {
        if (!activity.target) return { ...activity, target: null };

        let populatedTarget = null;

        try {
          switch (activity.targetModel) {
            case 'Board':
              populatedTarget = await mongoose.model('Board').findById(activity.target)
                .select('title _id')
                .lean();
              break;

            case 'Workspace':
              populatedTarget = await mongoose.model('Workspace').findById(activity.target)
                .select('name _id')
                .lean();
              break;

            case 'Card':
              populatedTarget = await mongoose.model('Card').findById(activity.target)
                .select('title board')
                .populate({
                  path: 'board',
                  select: 'workspace title',
                  match: { isDeleted: { $ne: true } },
                  populate: {
                    path: 'workspace',
                    select: '_id name',
                    match: { isDeleted: { $ne: true } }
                  }
                })
                .lean();
              break;

            default:
              populatedTarget = { _id: activity.target };
          }
        } catch (err) {
          console.warn(`Populate failed for ${activity.targetModel}:`, err.message);
          populatedTarget = null;
        }

        return {
          ...activity,
          target: populatedTarget || { _id: activity.target }
        };
      })
    );

    // Lọc hoạt động hợp lệ
    const validActivities = populatedActivities.filter(a => {
      if (a.targetModel === 'Card') {
        return a.target?.board?.workspace;
      }
      return !!a.target;
    });

    res.status(200).json({ activities: validActivities });
  } catch (error) {
    console.error('getActivities error:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy hoạt động',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.hideActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(activityId)) {
      return res.status(400).json({ message: "Activity ID không hợp lệ" });
    }

    const activity = await Activity.findOneAndUpdate(
      { _id: activityId, user: userId },
      { $set: { isHidden: true } },
      { new: true }
    );

    if (!activity) {
      return res.status(404).json({ message: "Hoạt động không tồn tại hoặc không thuộc về bạn" });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("activity-hidden", {
        activityId: activity._id,
        message: "Hoạt động đã được ẩn"
      });
    }

    res.status(200).json({ message: "Hoạt động đã được ẩn", activityId: activity._id });
  } catch (error) {
    console.error("hideActivity error:", error);
    res.status(500).json({ message: "Lỗi khi ẩn hoạt động", error: error.message });
  }
};

exports.hideAllActivities = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Activity.updateMany(
      { user: userId, isHidden: false },
      { $set: { isHidden: true } }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("all-activities-hidden", {
        message: "Tất cả hoạt động đã được ẩn",
        count: result.modifiedCount
      });
    }

    res.status(200).json({ 
      message: "Tất cả hoạt động đã được ẩn", 
      count: result.modifiedCount 
    });
  } catch (error) {
    console.error("hideAllActivities error:", error);
    res.status(500).json({ message: "Lỗi khi ẩn tất cả hoạt động", error: error.message });
  }
};