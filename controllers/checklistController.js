const mongoose = require("mongoose");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

const filterChecklists = (checklists) => {
  return checklists
    .filter((checklist) => !checklist.isDeleted)
    .map((checklist) => ({
      ...checklist.toObject(),
      items: checklist.items.filter((item) => !item.isDeleted),
    }));
};

const addChecklist = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { title } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!title || typeof title !== "string") return res.status(400).json({ message: "Title là bắt buộc và phải là chuỗi!" });
    if (!mongoose.Types.ObjectId.isValid(cardId)) return res.status(400).json({ message: "Card ID không hợp lệ!" });

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền thêm checklist vào thẻ này!" });

    const checklist = { _id: new mongoose.Types.ObjectId(), title, items: [], isDeleted: false };
    card.checklists.push(checklist);

    const activity = new Activity({
      user: userId,
      action: { category: "checklist", type: "added" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} added checklist "${title}" to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("checklist-added", {
        cardId,
        checklist,
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã thêm checklist "${title}" vào card "${card.title}"`,
      });
    }

    res.status(200).json(filterChecklists(card.checklists));
  } catch (error) {
    console.error("addChecklist error:", error.message);
    res.status(500).json({ message: "Lỗi khi thêm checklist" });
  }
};

const editChecklist = async (req, res) => {
  try {
    const { cardId, checklistId } = req.params;
    const { title } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      return res.status(400).json({ message: "Card ID hoặc checklist ID không hợp lệ!" });
    }
    if (!title || typeof title !== "string") return res.status(400).json({ message: "Tiêu đề checklist là bắt buộc và phải là chuỗi!" });

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền sửa checklist này!" });

    const checklist = card.checklists.id(checklistId);
    if (!checklist || checklist.isDeleted) return res.status(404).json({ message: "Không tìm thấy checklist hoặc checklist đã bị xóa!" });

    checklist.title = title;

    const activity = new Activity({
      user: userId,
      action: { category: "checklist", type: "updated" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} updated checklist title to "${title}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("checklist-updated", {
        cardId,
        checklistId,
        title,
        checklist: { _id: checklist._id, title: checklist.title, items: checklist.items.filter((item) => !item.isDeleted) },
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã cập nhật tiêu đề checklist thành "${title}" trong card "${card.title}"`,
      });
    }

    res.status(200).json(filterChecklists(card.checklists));
  } catch (error) {
    console.error("editChecklist error:", error.message);
    res.status(500).json({ message: "Lỗi khi sửa checklist" });
  }
};

const deleteChecklist = async (req, res) => {
  try {
    const { cardId, checklistId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      return res.status(400).json({ message: "Card ID hoặc checklist ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền xóa checklist này!" });

    const checklist = card.checklists.id(checklistId);
    if (!checklist || checklist.isDeleted) return res.status(404).json({ message: "Không tìm thấy checklist hoặc checklist đã bị xóa!" });

    const checklistTitle = checklist.title;
    checklist.isDeleted = true;

    const activity = new Activity({
      user: userId,
      action: { category: "checklist", type: "deleted" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} deleted checklist "${checklistTitle}" in card "${card.title}"`,
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
            message: `${req.user.fullName} đã xóa checklist "${checklistTitle}" trong card "${card.title}"`,
            type: "activity",
            target: card._id,
            targetModel: "Card",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => io.to(memberId.toString()).emit("new-notification", notification));
        });
      await Promise.all([card.save(), board.save(), ...notificationPromises]);

      io.to(card.board.toString()).emit("checklist-deleted", {
        cardId,
        checklistId,
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã xóa checklist "${checklistTitle}" trong card "${card.title}"`,
      });
    } else {
      await Promise.all([card.save(), board.save()]);
    }

    res.status(200).json(filterChecklists(card.checklists));
  } catch (error) {
    console.error("deleteChecklist error:", error.message);
    res.status(500).json({ message: "Lỗi khi xóa checklist" });
  }
};

module.exports = {
  addChecklist,
  addChecklistItem: require("./checklist/addChecklistItem"),
  toggleChecklistItem: require("./checklist/toggleChecklistItem"),
  editChecklist,
  deleteChecklist,
  editChecklistItem: require("./checklist/editChecklistItem"),
  deleteChecklistItem: require("./checklist/deleteChecklistItem"),
};