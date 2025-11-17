const Activity = require("../models/Activity");
const User = require("../models/User")

const activityMiddleware = (actionType, category, targetModel, detailsFn) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        console.error("activityMiddleware: Missing userId");
        return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
      }

      // Provide a default details string if detailsFn is not a function
      let details = `User ${req.user.fullName} performed ${actionType} on ${targetModel}`;
      if (typeof detailsFn === "function") {
        try {
          details = detailsFn(req);
        } catch (error) {
          console.error("activityMiddleware: Error in detailsFn", {
            message: error.message,
            stack: error.stack,
          });
          // Fallback to default details if detailsFn fails
        }
      }

      console.log("activityMiddleware: Generating activity data", {
        actionType,
        category,
        targetModel,
        details,
        userId,
      });

      req.activityData = {
        action: { type: actionType, category },
        target: req.body.card || req.params.id || req.body.board || req.body.list, // ← ĐẢM BẢO
        targetModel,
        details,
        user: userId,
      };

      next();
    } catch (error) {
      console.error("activityMiddleware error:", {
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ message: "Lỗi khi ghi hoạt động", error: error.message });
    }
  };
};

module.exports = activityMiddleware;