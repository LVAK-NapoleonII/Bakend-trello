const Activity = require("../models/Activity");

exports.getActivities = async (req, res) => {
  try {
    const userId = req.user._id;
    const activities = await Activity.find({ 
      user: userId,
      isHidden: false 
    })
      .sort({ createdAt: -1 })
      .populate("target", "name title")
      .lean();
    res.status(200).json({ activities });
  } catch (error) {
    console.error("Lỗi khi lấy hoạt động:", error);
    res.status(500).json({ message: "Lỗi khi lấy hoạt động", error: error.message });
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