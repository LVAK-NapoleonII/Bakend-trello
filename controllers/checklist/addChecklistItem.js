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

const addChecklistItem = async (req, res) => {
  try {
    const { cardId, checklistId } = req.params;
    const { title, content, version } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!title || typeof title !== "string" || !content || typeof content !== "string") {
      return res.status(400).json({ message: "Title và content là bắt buộc và phải là chuỗi!" });
    }
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      return res.status(400).json({ message: "Card ID hoặc checklist ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    if (version !== undefined && card.version !== version) {
      return res.status(409).json({ message: "Xung đột dữ liệu, vui lòng làm mới!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền thêm item vào checklist này!" });

    const checklist = card.checklists.id(checklistId);
    if (!checklist || checklist.isDeleted) return res.status(404).json({ message: "Không tìm thấy checklist hoặc checklist đã bị xóa!" });

    const newItem = { _id: new mongoose.Types.ObjectId(), title, content, completed: false, createdAt: new Date(), isDeleted: false };
    checklist.items.push(newItem);
    card.version += 1;

    const activity = new Activity({
      user: userId,
      action: { category: "checklist", type: "item_added" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} added item "${title}" to checklist in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("checklist-item-added", {
        cardId,
        checklistId,
        item: newItem,
        checklist: { _id: checklist._id, title: checklist.title, items: checklist.items.filter((item) => !item.isDeleted) },
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã thêm item "${title}" vào checklist trong card "${card.title}"`,
        actorId: userId.toString(),
      });
    }

    res.status(200).json({ checklists: filterChecklists(card.checklists), version: card.version });
  } catch (error) {
    console.error("addChecklistItem error:", error.message);
    res.status(500).json({ message: "Lỗi khi thêm item vào checklist" });
  }
};

module.exports = addChecklistItem;