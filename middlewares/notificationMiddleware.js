const Notification = require("../models/Notification");
const User = require("../models/User");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Workspace = require("../models/Workspace");
const List = require("../models/List");

const notificationMiddleware = (messageFn, type, targetModel) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        console.error("notificationMiddleware: Missing userId");
        return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
      }

      let targetId =
        req.params.cardId ||
        req.params.boardId ||
        req.params.workspaceId ||
        req.params.id ||
        req.body.targetId ||
        req.body.board ||
        req.body.list;

      if (!targetId) {
        console.warn("notificationMiddleware: Không có targetId hợp lệ", {
          params: req.params,
          body: req.body,
        });
        return next();
      }

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
        default:
          console.error("notificationMiddleware: Unsupported model", { targetModel });
          return next();
      }

      const isCreateAction = req.method === "POST" && (req.path === "/" || req.path.includes("/create"));
      let target = null;

      if (!isCreateAction) {
        target = await Model.findById(targetId);
        if (!target) {
          console.warn("notificationMiddleware: Target not found", { targetModel, targetId });
          return next();
        }
      }

      let recipients = [];

      if (targetModel === "Card") {
        if (target && target.members?.length) {
          recipients = target.members
            .map((member) => member.toString())
            .filter((id) => id !== userId.toString());
        }
      } else if (targetModel === "Board") {
        if (target && target.members?.length) {
          recipients = target.members
            .filter((m) => m.isActive && m.user)
            .map((m) => m.user.toString())
            .filter((id) => id !== userId.toString());
        }
      } else if (targetModel === "Workspace") {
        if (target && target.members?.length) {
          recipients = target.members.map((m) => m.toString()).filter((id) => id !== userId.toString());
        }
      } else if (targetModel === "List") {
        if (target?.board) {
          const board = await Board.findById(target.board).populate("members.user");
          recipients = board.members
            .filter((m) => m.isActive && m.user)
            .map((m) => m.user.toString())
            .filter((id) => id !== userId.toString());
        }
      }

      if (recipients.length === 0) {
        recipients = [userId];
      }

      const message = messageFn(req);
      if (!message) {
        console.warn("notificationMiddleware: messageFn trả về null/undefined");
        return next();
      }

      console.log(
        `[Notification] ${req.method} ${req.originalUrl} → targetModel=${targetModel}, targetId=${targetId}, recipients=${recipients.length}`
      );

      const notificationPromises = recipients.map(async (recipientId) => {
        const notification = new Notification({
          user: recipientId,
          message,
          type,
          target: targetId,
          targetModel,
          isRead: false,
          isHidden: false,
        });

        await notification.save();

        const user = await User.findById(recipientId);
        if (user && Array.isArray(user.notifications)) {
          user.notifications.push(notification._id);
          await user.save();
        }

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
        }
      });

      await Promise.all(notificationPromises);
      next();
    } catch (error) {
      console.error("notificationMiddleware error:", error);
      next();
    }
  };
};

module.exports = notificationMiddleware;
