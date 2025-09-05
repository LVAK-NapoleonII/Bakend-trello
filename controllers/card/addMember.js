const mongoose = require("mongoose");
const Card = require("../../models/Card");
const Board = require("../../models/Board");
const User = require("../../models/User");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");

const addMember = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { memberId } = req.body;
    const userId = req.user?._id;
    console.log("addMember called with:", {
      cardId,
      memberId,
      userId: userId?.toString(),
    });

    if (!userId) {
      console.error("addMember: Missing userId");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      console.error("addMember: Invalid cardId or memberId", { cardId, memberId });
      return res.status(400).json({ message: "Card ID hoặc Member ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.error("addMember: Card not found or deleted", { cardId });
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }
    console.log("addMember: Card found", { cardId, boardId: card.board });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.error("addMember: Board not found or deleted", { boardId: card.board });
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }
    console.log("addMember: Board found", {
      boardId: board._id,
      owner: board.owner.toString(),
      members: board.members.map(m => ({ user: m.user.toString(), isActive: m.isActive })),
    });

    const isOwner = board.owner.toString() === userId.toString();
    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isOwner && !isMember) {
      console.log("addMember: Access denied", { userId });
      return res.status(403).json({ message: "Bạn không có quyền thêm member vào thẻ này!" });
    }

    const isBoardMember = board.members.some((m) => m.user?.toString() === memberId && m.isActive);
    if (!isBoardMember) {
      console.error("addMember: Member not in board or not active", { memberId });
      return res.status(400).json({ message: "Member không thuộc board này!" });
    }

    if (card.members.some((m) => m.toString() === memberId)) {
      console.log("addMember: Member already in card", { memberId });
      return res.status(400).json({ message: "Member đã có trong thẻ!" });
    }

    card.members.push(memberId);
    await card.save();
    console.log("addMember: Card updated with new member", { cardId, memberId });

    // Ghi hoạt động
    if (req.activityData) {
      console.log("addMember: Saving activity", req.activityData);
      if (!req.activityData.action?.type || !req.activityData.user) {
        console.error("addMember: Invalid activity data", req.activityData);
        return res.status(400).json({ message: "Dữ liệu hoạt động không hợp lệ!" });
      }
      const activity = new Activity({
        ...req.activityData,
        target: cardId,
        board: card.board,
      });
      await activity.save();
      console.log("addMember: Activity saved", { activityId: activity._id });
    }

    res.status(200).json({ message: "Thêm thành viên thành công!", card });
  } catch (error) {
    console.error("addMember error:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Lỗi khi thêm member", error: error.message });
  }
};

module.exports = addMember;