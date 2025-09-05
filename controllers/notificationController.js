const mongoose = require("mongoose");
const Notification = require("../models/Notification");

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Không tìm thấy hoặc ID người dùng không hợp lệ!" });
    }


    const notifications = await Notification.find({
      user: userId,
      isHidden: false,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "target",
        select: "title name _id board workspace list", // Thêm trường list nếu cần
        match: { isDeleted: { $ne: true } },
      })
      .lean();


    const cardNotifications = notifications.filter(n => 
      n.target && n.targetModel === "Card"
    );
    
    const boardNotifications = notifications.filter(n => 
      n.target && n.targetModel === "Board"
    );


    const cardIds = cardNotifications.map(n => n.target._id);
    const cards = await mongoose.model("Card")
      .find({ _id: { $in: cardIds } })
      .populate({
        path: "board",
        select: "_id title workspace",
        match: { isDeleted: { $ne: true } },
        populate: {
          path: "workspace",
          select: "_id name",
          match: { isDeleted: { $ne: true } },
        }
      })
      .lean();

    const cardMap = new Map(cards.map(card => [card._id.toString(), card]));

 
    const boardIds = boardNotifications.map(n => n.target._id);
    const boards = await mongoose.model("Board")
      .find({ _id: { $in: boardIds } })
      .populate({
        path: "workspace",
        select: "_id name",
        match: { isDeleted: { $ne: true } },
      })
      .lean();

    const boardMap = new Map(boards.map(board => [board._id.toString(), board]));

 
    const enrichedNotifications = notifications.map(notification => {
      if (!notification.target) return null;
      
      // Xử lý Card: Thêm boardId và thông tin workspace
      if (notification.targetModel === "Card") {
        const card = cardMap.get(notification.target._id.toString());
        if (card && card.board && card.board.workspace) {
          return {
            ...notification,
            target: {
              ...notification.target,
              boardId: card.board._id, // Thêm boardId vào target
              board: card.board,       // Giữ nguyên thông tin board
              workspace: card.board.workspace
            }
          };
        }
        return null;
      }
      
      // Xử lý Board: Thêm workspaceId
      if (notification.targetModel === "Board") {
        const board = boardMap.get(notification.target._id.toString());
        if (board && board.workspace) {
          return {
            ...notification,
            target: {
              ...notification.target,
              workspaceId: board.workspace._id, // Thêm workspaceId
              workspace: board.workspace
            }
          };
        }
        return null;
      }
      
      return notification;
    });

    
    const validNotifications = enrichedNotifications.filter(n => n !== null);
    const unreadCount = validNotifications.filter(n => !n.isRead).length;

    res.status(200).json({ notifications: validNotifications, unreadCount });
  } catch (error) {
    console.error("getNotifications error:", error.message);
    res.status(500).json({ message: "Lỗi khi lấy thông báo" });
  }
};
module.exports = {
  getNotifications,
  markNotificationAsRead: require("./notification/markNotificationAsRead"),
  markAllNotificationsAsRead: require("./notification/markAllNotificationsAsRead"),
  deleteNotification: require("./notification/deleteNotification"),
  deleteAllNotifications: require("./notification/deleteAllNotifications"),
};