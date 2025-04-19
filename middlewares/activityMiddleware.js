const Activity = require("../models/Activity");

const activityMiddleware = (action, targetModel, detailsFn) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user._id) {
        console.log("No user found in req.user");
        return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
      }

      const userId = req.user._id;
      const details = detailsFn(req);

      // Lưu dữ liệu hoạt động vào req
      req.activityData = {
        action,
        targetModel,
        details,
        userId,
      };

      console.log("Activity middleware prepared:", req.activityData);
      next();
    } catch (error) {
      console.error("Activity middleware error:", error.message, error.stack);
      return res.status(500).json({ message: "Lỗi khi ghi hoạt động", error: error.message });
    }
  };
};

module.exports = activityMiddleware;