const mongoose = require("mongoose");
const Card = require("../../models/Card");
const Board = require("../../models/Board");
const Activity = require("../../models/Activity");

const filterChecklists = (checklists) => {
  return checklists
    .filter((checklist) => !checklist.isDeleted)
    .map((checklist) => ({
      ...checklist.toObject(),
      items: checklist.items.filter((item) => !item.isDeleted),
    }));
};

const editChecklistItem = async (req, res) => {
  try {
    const { cardId, checklistId, itemId } = req.params;
    const { title, content } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Card ID, checklist ID hoặc item ID không hợp lệ!" });
    }
    if (!title || typeof title !== "string" || !content || typeof content !== "string") {
      return res.status(400).json({ message: "Title và content là bắt buộc và phải là chuỗi!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền sửa checklist item này!" });

    const checklist = card.checklists.id(checklistId);
    if (!checklist || checklist.isDeleted) return res.status(404).json({ message: "Không tìm thấy checklist hoặc checklist đã bị xóa!" });

    const item = checklist.items.id(itemId);
    if (!item || item.isDeleted) return res.status(404).json({ message: "Không tìm thấy item hoặc item đã bị xóa!" });

    item.title = title;
    item.content = content;

    const activity = new Activity({
      user: userId,
      action: { category: "checklist", type: "item_updated" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} updated checklist item to "${title}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("checklist-item-updated", {
        cardId,
        checklistId,
        itemId,
        item,
        checklist: { _id: checklist._id, title: checklist.title, items: checklist.items.filter((item) => !item.isDeleted) },
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã cập nhật item "${title}" trong checklist của card "${card.title}"`,
      });
    }

    res.status(200).json(filterChecklists(card.checklists));
  } catch (error) {
    console.error("editChecklistItem error:", error.message);
    res.status(500).json({ message: "Lỗi khi sửa checklist item" });
  }
};

module.exports = editChecklistItem;