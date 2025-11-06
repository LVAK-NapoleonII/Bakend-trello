// controllers/board/removeMember.js
const mongoose = require("mongoose");
const Board = require("../../models/Board");
const User = require("../../models/User");
const Workspace = require("../../models/Workspace");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");
const Card = require("../../models/Card");

const removeMember = async (req, res) => {
  try {
    const { boardId, userId } = req.params;
    const actorId = req.user?._id;

    // === KIỂM TRA ĐẦU VÀO ===
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    if (!userId || userId === "undefined" || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "User ID không hợp lệ hoặc bị thiếu!" });
    }

    // === TÌM BOARD ===
    const board = await Board.findById(boardId).populate("workspace");
    if (!board) return res.status(404).json({ message: "Không tìm thấy bảng!" });

    // === KIỂM TRA QUYỀN ===
    if (!actorId || board.owner.toString() !== actorId.toString()) {
      return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền xóa thành viên!" });
    }

    if (board.owner.toString() === userId) {
      return res.status(400).json({ message: "Không thể xóa chủ phòng!" });
    }

    // === TÌM THÀNH VIÊN ===
    const member = board.members.find((m) => m.user.toString() === userId && m.isActive);
    if (!member) {
      return res.status(400).json({ message: "Người dùng không phải thành viên active!" });
    }

    // === CẬP NHẬT BOARD ===
    member.isActive = false;

    // === CẬP NHẬT CARD ===
    await Card.updateMany(
      { board: boardId, "members._id": userId },
      { $pull: { members: { _id: userId } } }
    );

    const affectedCards = await Card.find({ board: boardId, "members._id": userId }, "_id");
    const cardIds = affectedCards.map((card) => card._id.toString());

    // === CẬP NHẬT WORKSPACE ===
    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });

    const otherBoards = await Board.find({
      workspace: board.workspace,
      "members.user": userId,
      "members.isActive": true,
    });

    if (otherBoards.length === 0) {
      workspace.members = workspace.members.filter((m) => m.toString() !== userId);
      await workspace.save();
    }

    // === TÌM USER ===
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng!" });

    // === GHI ACTIVITY ===
    const activity = new Activity({
      user: actorId,
      action: { category: "member", type: "removed" },
      target: board._id,
      targetModel: "Board",
      details: `${req.user.fullName} đã xóa ${user.fullName} khỏi bảng "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    // === GỬI NOTIFICATION ===
    const notification = new Notification({
      user: userId,
      message: `Bạn đã bị xóa khỏi bảng "${board.title}" bởi ${req.user.fullName}`,
      type: "activity",
      target: board._id,
      targetModel: "Board",
      isRead: false,
      isHidden: false,
    });
    await notification.save();

    // === TRẢ VỀ BOARD ĐÃ CẬP NHẬT ===
    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline");

    // === GỬI SOCKET ===
    const io = req.app.get("io");
    if (io) {
      const emitData = {
        board: updatedBoard,
        deactivatedUserId: userId,
        cardIds,
        message: `${user.fullName} đã bị xóa khỏi bảng "${board.title}"`,
        workspaceRemoved: otherBoards.length === 0,
      };

      io.to(boardId).emit("member-deactivated", emitData);
      io.to(userId).emit("member-deactivated", emitData);
    }

    res.status(200).json({ message: "Đã xóa thành viên khỏi bảng!", board: updatedBoard, cardIds });

  } catch (error) {
    console.error("removeMember error:", error);
    res.status(500).json({ message: "Lỗi server khi xóa thành viên!" });
  }
};

module.exports = removeMember;