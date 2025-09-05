const mongoose = require("mongoose");
const Card = require("../../models/Card");
const Board = require("../../models/Board");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");
const User = require("../../models/User");

const hideNote = async (req, res) => {
  try {
    const { cardId, noteId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Card ID hoặc note ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền thu hồi ghi chú!" });

    const note = card.notes.id(noteId);
    if (!note) return res.status(404).json({ message: "Không tìm thấy ghi chú!" });
    if (note.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Bạn chỉ có thể thu hồi ghi chú của chính mình!" });
    }
    if (note.isDeleted) return res.status(400).json({ message: "Ghi chú đã được thu hồi trước đó!" });

    note.isDeleted = true;

    const activity = new Activity({
      user: userId,
      action: { category: "note", type: "hidden" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} hid note "${note.content}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);

    const io = req.app.get("io");
    if (io) {
      const notificationPromises = card.members
        .filter((memberId) => memberId.toString() !== userId.toString())
        .map((memberId) => {
          const notification = new Notification({
            user: memberId,
            message: `${req.user.fullName} đã thu hồi một ghi chú trong card "${card.title}"`,
            type: "activity",
            target: card._id,
            targetModel: "Card",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => io.to(memberId.toString()).emit("new-notification", notification));
        });
      await Promise.all([card.save(), board.save(), ...notificationPromises]);

      io.to(card.board.toString()).emit("note-hidden", {
        cardId,
    commentId,
    // Trả về updated comments list
    updatedComments: await Comment.find({ card: cardId, isDeleted: false })
      .populate("user", "fullName email avatar")
      .sort({ createdAt: -1 }),
    boardId: card.board.toString(),
    message: `${req.user.fullName} đã thu hồi ghi chú trong card "${card.title}"`,});
    } else {
      await Promise.all([card.save(), board.save()]);
    }

    res.status(200).json({ message: "Đã thu hồi ghi chú" });
  } catch (error) {
    console.error("hideNote error:", error.message);
    res.status(500).json({ message: "Lỗi khi thu hồi ghi chú" });
  }
};

module.exports = hideNote;