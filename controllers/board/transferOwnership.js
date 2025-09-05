const mongoose = require("mongoose");
const Board = require("../../models/Board");
const User = require("../../models/User");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");

const transferOwnership = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { newOwnerId } = req.body;
    const userId = req.user?._id;
    if (!mongoose.Types.ObjectId.isValid(boardId) || !mongoose.Types.ObjectId.isValid(newOwnerId)) {
      return res.status(400).json({ message: "Board ID hoặc User ID không hợp lệ!" });
    }
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Không tìm thấy bảng!" });
    if (board.owner.toString() !== userId.toString()) return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền chuyển quyền sở hữu!" });

    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) return res.status(404).json({ message: "Không tìm thấy người dùng!" });

    const isMember = board.members.some((m) => m.user.toString() === newOwnerId && m.isActive);
    if (!isMember) return res.status(400).json({ message: "Người dùng không phải thành viên của bảng!" });

    board.owner = newOwnerId;
    await board.save();

    const activity = new Activity({
      user: userId,
      action: { category: "board", type: "ownership_transferred" },
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} transferred ownership of board "${board.title}" to ${newOwner.fullName}`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    const notification = new Notification({
      user: newOwnerId,
      message: `Bạn đã được chuyển quyền sở hữu board "${board.title}" bởi ${req.user.fullName}`,
      type: "activity",
      target: board._id,
      targetModel: "Board",
      isRead: false,
      isHidden: false,
    });
    await notification.save();
    newOwner.notifications.push(notification._id);
    await newOwner.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("invitedUsers.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline");

    const io = req.app.get("io");
    if (io) {
      io.to(boardId).emit("board-updated", {
        board: updatedBoard,
        message: `Quyền sở hữu board "${board.title}" đã được chuyển cho ${newOwner.fullName}`,
      });
      io.to(newOwnerId).emit("new-notification", notification);
    }

    res.status(200).json({ message: "Chuyển quyền sở hữu thành công!", board: updatedBoard });
  } catch (error) {
    console.error("transferOwnership error:", error.message);
    res.status(500).json({ message: "Lỗi server khi chuyển quyền sở hữu!" });
  }
};

module.exports = transferOwnership;