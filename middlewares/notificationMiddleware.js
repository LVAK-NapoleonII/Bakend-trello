const Notification = require("../models/Notification");
const User = require("../models/User");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Workspace = require("../models/Workspace");
const List = require("../models/List");
const Comment = require("../models/Comment");
const Note = require("../models/Note");
const Checklist = require("../models/Checklist");

const notificationMiddleware = (messageFn, type, targetModel) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      console.log("notificationMiddleware called with:", {
        targetModel,
        method: req.method,
        params: req.params,
        body: req.body,
        userId: userId?.toString(),
      });

      if (!userId) {
        console.error("notificationMiddleware: Missing userId");
        return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
      }

      let targetId = req.params.cardId || req.params.boardId || req.params.id || req.body.targetId || req.body.board || req.body.list;
      if (!targetId) {
        console.error("notificationMiddleware: Missing targetId", { params: req.params, body: req.body });
        return res.status(400).json({ message: "Thiếu ID mục tiêu!" });
      }
      console.log("notificationMiddleware: targetId", targetId);

      let Model;
      switch (targetModel) {
        case "Card":
          Model = Card;
          break;
        case "Board":
          Model = Board;
          break;
        case "Workspace":
          Model = Workspace;
          break;
        case "List":
          Model = List;
          break;
        case "Comment":
          Model = Comment;
          break;
        default:
          console.error("notificationMiddleware: Unsupported model", { targetModel });
          return res.status(500).json({ message: `Model ${targetModel} không được hỗ trợ` });
      }

      let target;
      if (!(req.method === 'POST' && targetModel === "Card")) {
        target = await Model.findById(targetId);
        if (!target) {
          console.error("notificationMiddleware: Target not found", { targetModel, targetId });
          return res.status(404).json({ message: `${targetModel} không tồn tại` });
        }
      } else {
        target = { members: [] };
        console.log(`notificationMiddleware: Skipping existence check for create ${targetModel}`);
      }

      let recipients = [userId.toString()];
      if (targetModel === "Card") {
        recipients = [
          ...new Set([
            ...recipients,
            ...target.members.map((member) => member.toString()),
          ]),
        ].filter((id) => id !== userId.toString());
      }
      console.log("notificationMiddleware: Recipients", recipients);

      const message = messageFn(req);

      for (const recipientId of recipients) {
        console.log("notificationMiddleware: Creating notification for", { recipientId });
        const notification = new Notification({
          user: recipientId,
          message,
          type,
          target: targetId,
          targetModel,
        });
        await notification.save();
        console.log("notificationMiddleware: Notification saved", { notificationId: notification._id });

        const user = await User.findById(recipientId);
        if (user) {
          user.notifications.push(notification._id);
          await user.save();
          console.log("notificationMiddleware: User updated with notification", { userId: recipientId });

          const io = req.app.get("io");
          if (io) {
            io.to(recipientId).emit("new-notification", {
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
            console.log("notificationMiddleware: Notification emitted to", { recipientId });
          } else {
            console.warn("notificationMiddleware: Socket.io not available");
          }
        } else {
          console.warn("notificationMiddleware: User not found", { recipientId });
        }
      }

      next();
    } catch (error) {
      console.error("notificationMiddleware error:", {
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ message: "Lỗi khi gửi thông báo", error: error.message });
    }
  };
};
module.exports = notificationMiddleware;