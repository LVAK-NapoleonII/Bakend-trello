const mongoose = require("mongoose");
const Board = require("../../models/Board");
const Workspace = require("../../models/Workspace");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");
const Card = require("../../models/Card");

const leaveBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user?._id;
    if (!mongoose.Types.ObjectId.isValid(boardId)) return res.status(400).json({ message: "Board ID không hợp lệ!" });
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    const board = await Board.findOne({ _id: boardId, isDeleted: false }).populate("workspace");
    if (!board) return res.status(404).json({ message: "Không tìm thấy bảng!" });
    if (board.owner.toString() === userId.toString()) return res.status(400).json({ message: "Chủ phòng không thể rời bảng!" });

    const member = board.members.find((m) => m.user.toString() === userId.toString() && m.isActive);
    if (!member) return res.status(403).json({ message: "Bạn không phải thành viên của bảng này!" });

    member.isActive = false;

    await Card.updateMany(
      { board: boardId, "members._id": userId },
      { $pull: { members: { _id: userId } } }
    );

    const affectedCards = await Card.find({ board: boardId, "members._id": userId }, "_id");
    const cardIds = affectedCards.map((card) => card._id.toString());

    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });

    const otherBoards = await Board.find({
      workspace: board.workspace,
      "members.user": userId,
      "members.isActive": true,
    });
    if (otherBoards.length === 0) {
      workspace.members = workspace.members.filter((m) => m.toString() !== userId.toString());
      await workspace.save();
    }

    const activity = new Activity({
      user: userId,
      action: { category: "member", type: "left" },
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} left board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    const notification = new Notification({
      user: userId,
      message: `Bạn đã rời khỏi bảng "${board.title}"`,
      type: "activity",
      target: board._id,
      targetModel: "Board",
      isRead: false,
      isHidden: false,
    });
    await notification.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline");

    const io = req.app.get("io");
    if (io) {
      io.to(boardId).emit("member-deactivated", {
        board: updatedBoard,
        deactivatedUserId: userId,
        cardIds,
        message: `${req.user.fullName} đã rời khỏi bảng "${board.title}"`,
        workspaceRemoved: otherBoards.length === 0,
      });
      io.to(userId.toString()).emit("member-deactivated", {
        board: updatedBoard,
        deactivatedUserId: userId,
        cardIds,
        message: `Bạn đã rời khỏi bảng "${board.title}"`,
        workspaceRemoved: otherBoards.length === 0,
      });
    }

    res.status(200).json({
      message: "Đã rời khỏi bảng thành công!",
      board: updatedBoard,
      cardIds,
      redirect: "/boards",
    });
  } catch (error) {
    console.error("leaveBoard error:", error.message);
    res.status(500).json({ message: "Lỗi server khi rời bảng!" });
  }
};

module.exports = leaveBoard;