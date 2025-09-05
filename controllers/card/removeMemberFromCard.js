const mongoose = require("mongoose");
const Card = require("../../models/Card");
const Board = require("../../models/Board");
const User = require("../../models/User");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");

const removeMemberFromCard = async (req, res) => {
  try {
    const { cardId, memberId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: "Card ID hoặc Member ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isOwner = board.owner?.toString() === userId.toString();
    if (!isOwner) return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền xóa thành viên khỏi card!" });

    if (!card.members.some((m) => m.toString() === memberId)) {
      return res.status(404).json({ message: "Thành viên không tồn tại trong card!" });
    }

    card.members = card.members.filter((m) => m.toString() !== memberId);

    const member = await User.findById(memberId);
    const memberName = member ? member.fullName || member.email || "Unknown User" : "Unknown User";

    const activity = new Activity({
      user: userId,
      action: { category: "member", type: "removed" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} removed ${memberName} from card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);

    if (member) {
      const notification = new Notification({
        user: memberId,
        message: `Bạn đã bị xóa khỏi card "${card.title}" bởi ${req.user.fullName}`,
        type: "activity",
        target: card._id,
        targetModel: "Card",
        isRead: false,
        isHidden: false,
      });
      await notification.save();

      const io = req.app.get("io");
      if (io) {
        io.to(memberId.toString()).emit("new-notification", notification);
      }
    }

    await Promise.all([card.save(), board.save()]);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("member-removed-from-card", {
        cardId,
        memberId,
        message: `${req.user.fullName} đã xóa ${memberName} khỏi card "${card.title}"`,
      });
    }

    res.status(200).json(updatedCard.members);
  } catch (error) {
    console.error("removeMemberFromCard error:", error.message);
    res.status(500).json({ message: "Lỗi khi xóa thành viên khỏi card" });
  }
};

module.exports = removeMemberFromCard;