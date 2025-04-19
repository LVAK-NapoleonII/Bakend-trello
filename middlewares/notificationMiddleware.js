const Notification = require("../models/Notification");
const User = require("../models/User");

const notificationMiddleware = (messageFn, type, targetModel) => {
  return async (req, res, next) => {
    try {
      let userId;
      let targetId;

      console.log("notificationMiddleware:", {
        targetModel,
        params: req.params,
        body: req.body,
        userId: req.user?._id?.toString(),
      });

      if (targetModel === "User" && req.body.email && !req.user) {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
          console.log("User not found:", req.body.email);
          return res.status(404).json({ message: "User không tồn tại" });
        }
        userId = user._id;
        targetId = user._id;
      } else {
        userId = req.user?._id;
        if (!userId) {
          console.log("No user found in req.user");
          return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
        }
        // Linh hoạt lấy targetId dựa trên route
        targetId =
          req.params.boardId||
          req.params.cardId || // Cho các route như /api/cards/:cardId/comments
          req.params.id ||     // Cho các route như /api/cards/:id
          req.body.targetId ||
          userId;
      }

      if (!targetId) {
        console.log("No targetId found");
        return res.status(400).json({ message: "Thiếu ID mục tiêu!" });
      }

      const message = messageFn(req);

      let Model;
      try {
        const modelPath = `../models/${targetModel}`;
        require.resolve(modelPath);
        Model = require(modelPath);
      } catch (error) {
        console.error(`Model ${targetModel} not found:`, error.message);
        return res.status(500).json({ message: `Model ${targetModel} không tồn tại` });
      }

      const target = await Model.findById(targetId);
      if (!target) {
        console.log(`${targetModel} not found:`, targetId);
        return res.status(404).json({ message: `${targetModel} không tồn tại` });
      }

      const notification = new Notification({
        user: userId,
        message,
        type,
        target: targetId,
        targetModel,
      });
      await notification.save();

      const user = await User.findById(userId);
      if (user) {
        user.notifications = user.notifications || [];
        user.notifications.push(notification._id);
        await user.save();
      }

      next();
    } catch (error) {
      console.error("Notification middleware error:", {
        message: error.message,
        stack: error.stack,
        targetModel,
        targetId,
        userId: req.user?._id?.toString(),
      });
      return res.status(500).json({ message: "Lỗi khi gửi thông báo", error: error.message });
    }
  };
};

module.exports = notificationMiddleware;