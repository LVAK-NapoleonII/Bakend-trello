const mongoose = require("mongoose");
const Card = require("../../models/Card");
const Board = require("../../models/Board");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");

const filterChecklists = (checklists) => {
  return checklists
    .filter((checklist) => !checklist.isDeleted)
    .map((checklist) => ({
      ...checklist.toObject(),
      items: checklist.items.filter((item) => !item.isDeleted),
    }));
};

const deleteChecklistItem = async (req, res) => {
  try {
    const { cardId, checklistId, itemId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Card ID, checklist ID hoặc item ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền xóa checklist item này!" });

    const checklist = card.checklists.id(checklistId);
    if (!checklist || checklist.isDeleted) return res.status(404).json({ message: "Không tìm thấy checklist hoặc checklist đã bị xóa!" });

    const item = checklist.items.id(itemId);
    if (!item || item.isDeleted) return res.status(404).json({ message: "Không tìm thấy item hoặc item đã bị xóa!" });

    const itemTitle = item.title;
    item.isDeleted = true;

    const activity = new Activity({
      user: userId,
      action: { category: "checklist", type: "item_deleted" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} deleted item "${itemTitle}" from checklist in card "${card.title}"`,
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
            message: `${req.user.fullName} đã xóa item "${itemTitle}" khỏi checklist trong card "${card.title}"`,
            type: "activity",
            target: card._id,
            targetModel: "Card",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => io.to(memberId.toString()).emit("new-notification", notification));
        });
      await Promise.all([card.save(), board.save(), ...notificationPromises]);

      io.to(card.board.toString()).emit("checklist-item-deleted", {
        cardId,
        checklistId,
        itemId,
        checklist: { _id: checklist._id, title: checklist.title, items: checklist.items.filter((item) => !item.isDeleted) },
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã xóa item "${itemTitle}" khỏi checklist trong card "${card.title}"`,
      });
    } else {
      await Promise.all([card.save(), board.save()]);
    }

    res.status(200).json(filterChecklists(card.checklists));
  } catch (error) {
    console.error("deleteChecklistItem error:", error.message);
    res.status(500).json({ message: "Lỗi khi xóa checklist item" });
  }
};

module.exports = deleteChecklistItem;