const Notification = require("../models/Notification");
const User = require("../models/User");
const Card = require("../models/Card");

const notificationMiddleware = (messageFn, type, targetModel) => {
  return async (req, res, next) => {
    try {
      let userId = req.user?._id;
      let targetId;

      console.log("notificationMiddleware: Processing", {
        targetModel,
        params: req.params,
        body: req.body,
        userId: userId?.toString(),
      });

      if (!userId) {
        console.error("notificationMiddleware: No user found in req.user");
        return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
      }

      targetId =
        req.params.boardId ||
        req.params.cardId ||
        req.params.id ||
        req.body.targetId ||
        userId;

      if (!targetId) {
        console.error("notificationMiddleware: No targetId found");
        return res.status(400).json({ message: "Thiếu ID mục tiêu!" });
      }

      let Model;
      try {
        const modelPath = `../models/${targetModel}`;
        require.resolve(modelPath);
        Model = require(modelPath);
      } catch (error) {
        console.error(`notificationMiddleware: Model ${targetModel} not found:`, error.message);
        return res.status(500).json({ message: `Model ${targetModel} không tồn tại` });
      }

      const target = await Model.findById(targetId);
      if (!target) {
        console.error(`notificationMiddleware: ${targetModel} not found for ID:`, targetId);
        return res.status(404).json({ message: `${targetModel} không tồn tại` });
      }

      let recipients = [userId];
      if (targetModel === "Card") {
        const card = await Card.findById(targetId).populate("members");
        if (card && card.members) {
          recipients = [
            ...new Set([
              ...recipients,
              ...card.members.map((member) => member._id.toString()),
            ]),
          ].filter((id) => id !== userId.toString());
        }
      } else if (targetModel === "Board") {
        // Thêm logic nếu cần gửi thông báo cho thành viên board
      }

      const message = messageFn(req);
      console.log("notificationMiddleware: Creating notification with message:", message);

      for (const recipientId of recipients) {
        const notification = new Notification({
          user: recipientId,
          message,
          type,
          target: targetId,
          targetModel,
        });
        await notification.save();
        console.log("notificationMiddleware: Notification saved:", {
          _id: notification._id,
          user: recipientId,
          message,
          type,
          target: targetId,
          targetModel,
        });

        const user = await User.findById(recipientId);
        if (user) {
          user.notifications = user.notifications || [];
          user.notifications.push(notification._id);
          await user.save();

          if (req.app.get("io")) {
            console.log("notificationMiddleware: Emitting new-notification to:", recipientId.toString());
            req.app.get("io").to(recipientId.toString()).emit("new-notification", {
              _id: notification._id,
              user: recipientId,
              message,
              type,
              target: targetId,
              targetModel,
              isRead: false,
              isHidden: false,
              createdAt: notification.createdAt,
            });
          } else {
            console.warn("notificationMiddleware: Socket.IO instance not found");
          }
        }
      }

      next();
    } catch (error) {
      console.error("notificationMiddleware: Error:", {
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