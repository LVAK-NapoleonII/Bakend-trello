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
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: "ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isOwner = board.owner.toString() === userId.toString();
    const isMember = board.members.some(m => m.user?.toString() === userId.toString() && m.isActive);
    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "Không có quyền!" });
    }

    const isBoardMember = board.members.some(m => m.user?.toString() === memberId && m.isActive);
    if (!isBoardMember) {
      return res.status(400).json({ message: "Member không thuộc board!" });
    }

    // KIỂM TRA TRÙNG TRONG CARD
    if (card.members.some(m => m.toString() === memberId)) {
      return res.status(400).json({ message: "Member đã có trong thẻ!" });
    }

    // CHUYỂN memberId → ObjectId
    card.members.push(new mongoose.Types.ObjectId(memberId));
    await card.save();

    // GHI HOẠT ĐỘNG
    if (req.activityData) {
      const activity = new Activity({
        ...req.activityData,
        target: cardId,
        board: card.board,
      });
      await activity.save();
    }

    // GỬI SOCKET REALTIME
    if (req.io && req.connectedUsers) {
      req.io.to(card.board.toString()).emit("member-added", {
        cardId,
        member: {
          _id: memberId,
          fullName: "Tên user", // LẤY TỪ DB NẾU CẦN
          isActive: true,
        },
        clientId: req.socketId,
      });
    }

    res.status(200).json({ message: "Thêm thành viên thành công!", card });
  } catch (error) {
    console.error("addMember error:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = addMember;